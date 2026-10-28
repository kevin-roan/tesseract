// tesseract-simcap: streams an iOS Simulator screen as H.264 by reading the framebuffer through Apple's private
// CoreSimulator/SimulatorKit frameworks (no idb, no ScreenCaptureKit, no TCC prompt) and encoding it with VideoToolbox.
// CLI, stdout framing and exit codes: see README.md. Verified on macOS 26.2 / Xcode 26.2 with iOS 18.1 simulators.
//
// What works on Xcode 26.2:
// - SimDevice.io.ioPorts[].descriptor are ROCKRemoteProxy (XPC) objects: KVC does not work on them, so every call is a
//   typed IMP call through class_getMethodImplementation (the forwarding IMP honours the C signature).
// - Each display is a port whose descriptor implements <SimScreen>: registerScreenCallbacksWithUUID:... delivers one
//   frameCallback per presented frame. Older Xcodes only have the ioSurfacesChange + damageRectangles callbacks.
// - The framebuffer IOSurface is drawn into in place, so it is copied into a private NV12 buffer at callback time;
//   encoding the live surface later smears transitions.
// - Callbacks must be unregistered before exit, or CoreSimulatorService keeps calling into a dead process.
// - When the device shuts down the surface simply stops; SimDevice.state (3 = Booted) is polled to notice it.
import CoreMedia
import CoreVideo
import Foundation
import IOSurface
import ObjectiveC
import VideoToolbox

let version = "1.0.0"
let usage = """
  usage: tesseract-simcap --version
         tesseract-simcap probe --udid <UDID> [--developer-dir <dir>]
         tesseract-simcap stream --udid <UDID> [--bitrate <bps>] [--fps <max>] [--keyint-sec <s>] [--max-side <px>]
                                 [--idle-fps <n>] [--screen-id <n>] [--developer-dir <dir>] [--api screen|damage]
                                 [--stats-sec <s>]
  """

let exitSetup: Int32 = 1
let exitNotBooted: Int32 = 3
let simDeviceStateBooted = 3

func log(_ dict: [String: Any]) {
  guard var data = try? JSONSerialization.data(withJSONObject: dict, options: [.withoutEscapingSlashes]) else { return }
  data.append(0x0A)
  FileHandle.standardError.write(data)
}

var probeMode = false

func fail(_ message: String) -> Never {
  if probeMode {
    var data = (try? JSONSerialization.data(withJSONObject: ["ok": false, "message": message], options: [.withoutEscapingSlashes])) ?? Data()
    data.append(0x0A)
    FileHandle.standardOutput.write(data)
  } else {
    log(["event": "error", "message": message])
  }
  exit(exitSetup)
}

// MARK: arguments

let argv = Array(CommandLine.arguments.dropFirst())
if argv.first == "--version" || argv.first == "-v" {
  print(version)
  exit(0)
}
if argv.first == "--help" || argv.first == "-h" {
  print(usage)
  exit(0)
}
guard let command = argv.first, command == "probe" || command == "stream" else {
  FileHandle.standardError.write((usage + "\n").data(using: .utf8)!)
  exit(exitSetup)
}
probeMode = command == "probe"

let knownOptions: Set<String> = probeMode
  ? ["udid", "developer-dir"]
  : ["udid", "developer-dir", "bitrate", "fps", "keyint-sec", "max-side", "idle-fps", "screen-id", "api", "stats-sec"]
var opts: [String: String] = [:]
do {
  var i = 1
  while i < argv.count {
    let arg = argv[i]
    guard arg.hasPrefix("--"), knownOptions.contains(String(arg.dropFirst(2))) else { fail("unknown argument \(arg)") }
    guard i + 1 < argv.count else { fail("\(arg) needs a value") }
    opts[String(arg.dropFirst(2))] = argv[i + 1]
    i += 2
  }
}

func number(_ key: String, _ fallback: Double, min lower: Double) -> Double {
  guard let raw = opts[key] else { return fallback }
  guard let value = Double(raw), value.isFinite, value >= lower else { fail("--\(key) must be a number >= \(lower)") }
  return value
}

guard let udid = opts["udid"]?.uppercased(), !udid.isEmpty else { fail("--udid is required") }
let bitrate = Int(number("bitrate", 6_000_000, min: 100_000))
let maxFps = number("fps", 60, min: 1)
let keyIntSec = number("keyint-sec", 2, min: 0.1)
let maxSide = Int(number("max-side", 0, min: 0))
let idleFps = number("idle-fps", 1, min: 0.1)
let statsSec = number("stats-sec", 5, min: 0.5)
let wantScreen = opts["screen-id"].map { raw -> UInt32 in
  guard let id = UInt32(raw) else { fail("--screen-id must be an unsigned integer") }
  return id
}
let apiChoice = opts["api"] ?? "screen"
guard apiChoice == "screen" || apiChoice == "damage" else { fail("--api must be screen or damage") }

func defaultDeveloperDir() -> String {
  if let env = ProcessInfo.processInfo.environment["DEVELOPER_DIR"], !env.isEmpty { return env }
  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/xcode-select")
  process.arguments = ["-p"]
  let pipe = Pipe()
  process.standardOutput = pipe
  process.standardError = FileHandle.nullDevice
  if (try? process.run()) != nil {
    let out = pipe.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    let path = String(decoding: out, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
    if process.terminationStatus == 0 && !path.isEmpty { return path }
  }
  return "/Applications/Xcode.app/Contents/Developer"
}
let devDir = opts["developer-dir"] ?? defaultDeveloperDir()

signal(SIGPIPE, SIG_IGN)

// CoreSimulatorService can hang on a wedged host; never let probe or stream setup block forever.
let setupDone = DispatchSemaphore(value: 0)
DispatchQueue.global().async {
  if setupDone.wait(timeout: .now() + 20) == .timedOut { fail("timed out talking to CoreSimulator") }
}

// MARK: private frameworks

guard dlopen("/Library/Developer/PrivateFrameworks/CoreSimulator.framework/CoreSimulator", RTLD_NOW) != nil else {
  fail("cannot load CoreSimulator.framework")
}
guard dlopen(devDir + "/Library/PrivateFrameworks/SimulatorKit.framework/SimulatorKit", RTLD_NOW) != nil else {
  fail("cannot load SimulatorKit.framework from \(devDir)")
}

@Sendable func impl<F>(_ obj: AnyObject, _ sel: Selector, _: F.Type) -> F? {
  guard obj.responds(to: sel), let cls = object_getClass(obj), let imp = class_getMethodImplementation(cls, sel) else {
    return nil
  }
  return unsafeBitCast(imp, to: F.self)
}

func callObject(_ obj: AnyObject, _ name: String) -> AnyObject? {
  let sel = NSSelectorFromString(name)
  guard obj.responds(to: sel) else { return nil }
  return obj.perform(sel)?.takeUnretainedValue()
}

func callU32(_ obj: AnyObject, _ name: String) -> UInt32? {
  typealias F = @convention(c) (AnyObject, Selector) -> UInt32
  let sel = NSSelectorFromString(name)
  return impl(obj, sel, F.self).map { $0(obj, sel) }
}

func callU16(_ obj: AnyObject, _ name: String) -> UInt16? {
  typealias F = @convention(c) (AnyObject, Selector) -> UInt16
  let sel = NSSelectorFromString(name)
  return impl(obj, sel, F.self).map { $0(obj, sel) }
}

func callSize(_ obj: AnyObject, _ name: String) -> CGSize? {
  typealias F = @convention(c) (AnyObject, Selector) -> CGSize
  let sel = NSSelectorFromString(name)
  return impl(obj, sel, F.self).map { $0(obj, sel) }
}

guard let ctxClass: AnyClass = NSClassFromString("SimServiceContext") else { fail("SimServiceContext is missing") }
let ctx: AnyObject
do {
  typealias F = @convention(c) (AnyObject, Selector, NSString, UnsafeMutablePointer<NSError?>?) -> AnyObject?
  let sel = NSSelectorFromString("sharedServiceContextForDeveloperDir:error:")
  guard let method = class_getClassMethod(ctxClass, sel) else { fail("SimServiceContext API is missing") }
  var error: NSError?
  let call = unsafeBitCast(method_getImplementation(method), to: F.self)
  guard let value = call(ctxClass, sel, devDir as NSString, &error) else {
    fail("no CoreSimulator service context: \(error?.localizedDescription ?? "unknown error")")
  }
  ctx = value
}
let device: AnyObject
do {
  typealias F = @convention(c) (AnyObject, Selector, UnsafeMutablePointer<NSError?>?) -> AnyObject?
  let sel = NSSelectorFromString("defaultDeviceSetWithError:")
  var error: NSError?
  guard let call = impl(ctx, sel, F.self), let deviceSet = call(ctx, sel, &error) else {
    fail("no CoreSimulator device set: \(error?.localizedDescription ?? "unknown error")")
  }
  guard let devices = deviceSet.value(forKey: "devices") as? [AnyObject],
        let found = devices.first(where: { ($0.value(forKey: "UDID") as? NSUUID)?.uuidString == udid })
  else { fail("device \(udid) not found") }
  device = found
}

func deviceState() -> Int? { (device.value(forKey: "state") as? NSNumber)?.intValue }

guard deviceState() == simDeviceStateBooted else { fail("device \(udid) is not booted") }
guard let io = callObject(device, "io"), let ports = io.value(forKey: "ioPorts") as? [AnyObject] else {
  fail("device \(udid) has no io ports")
}

// MARK: screen port

// Pick --screen-id, else the lowest screenID (the main "LCD" screen).
var display: AnyObject?
var displayScreenID = UInt32.max
var displayPixelSize: CGSize?
for port in ports {
  guard let desc = callObject(port, "descriptor"), desc.responds(to: NSSelectorFromString("framebufferSurface")) else {
    continue
  }
  var info: [String: Any] = ["event": "screen"]
  var sid = UInt32.max - 1
  var size: CGSize?
  if let props = callObject(desc, "screenProperties") {
    sid = callU32(props, "screenID") ?? sid
    info["screenID"] = sid
    info["name"] = (callObject(props, "name") as? String) ?? ""
    size = callSize(props, "pixelSize")
  } else if let state = callObject(desc, "state"), let cls = callU16(state, "displayClass") {
    sid = UInt32(cls)
    info["displayClass"] = Int(cls)
  }
  if let size {
    info["width"] = Int(size.width)
    info["height"] = Int(size.height)
  }
  if !probeMode { log(info) }
  if let want = wantScreen {
    if sid == want { display = desc; displayScreenID = sid; displayPixelSize = size }
  } else if display == nil || sid < displayScreenID {
    display = desc
    displayScreenID = sid
    displayPixelSize = size
  }
}
guard let display else {
  fail(wantScreen == nil ? "no framebuffer screen port" : "no framebuffer screen port with screenID \(wantScreen!)")
}

let screenSel = NSSelectorFromString(
  "registerScreenCallbacksWithUUID:callbackQueue:frameCallback:surfacesChangedCallback:propertiesChangedCallback:")
let surfacesSel = NSSelectorFromString("registerCallbackWithUUID:ioSurfacesChangeCallback:")
let damageSel = NSSelectorFromString("registerCallbackWithUUID:damageRectanglesCallback:")
let hasScreenAPI = display.responds(to: screenSel)
let hasDamageAPI = display.responds(to: surfacesSel) && display.responds(to: damageSel)
let api: String
if hasScreenAPI && apiChoice == "screen" {
  api = "screen"
} else if hasDamageAPI {
  api = "damage"
} else {
  fail("screen port has neither the SimScreen nor the damage callback API")
}

func surfaceRef(_ obj: AnyObject?) -> IOSurfaceRef? { obj.map { unsafeBitCast($0, to: IOSurfaceRef.self) } }

if probeMode {
  var size = displayPixelSize ?? .zero
  if size == .zero, let surf = surfaceRef(callObject(display, "framebufferSurface")) {
    size = CGSize(width: IOSurfaceGetWidth(surf), height: IOSurfaceGetHeight(surf))
  }
  let result: [String: Any] = ["ok": true, "api": api, "width": Int(size.width), "height": Int(size.height)]
  var data = (try? JSONSerialization.data(withJSONObject: result, options: [.withoutEscapingSlashes])) ?? Data()
  data.append(0x0A)
  FileHandle.standardOutput.write(data)
  exit(0)
}

// MARK: output framing

enum PacketFlag: UInt8 {
  case delta = 0x00
  case config = 0x01
  case key = 0x02
  case size = 0x80
}

func writeAll(_ data: Data) -> Bool {
  data.withUnsafeBytes { raw in
    guard let base = raw.baseAddress else { return true }
    var off = 0
    while off < raw.count {
      let n = write(STDOUT_FILENO, base + off, raw.count - off)
      if n < 0 && errno == EINTR { continue }
      if n <= 0 { return false }
      off += n
    }
    return true
  }
}

func writePacket(_ flag: PacketFlag, _ payload: Data) {
  var packet = Data(capacity: payload.count + 5)
  let len = UInt32(payload.count).bigEndian
  withUnsafeBytes(of: len) { packet.append(contentsOf: $0) }
  packet.append(flag.rawValue)
  packet.append(payload)
  if !writeAll(packet) { finish(0) }
}

// MARK: encoder (all state below is only touched on `q`)

let q = DispatchQueue(label: "tesseract-simcap.capture", qos: .userInteractive)
var session: VTCompressionSession?
var transfer: VTPixelTransferSession?
var pool: CVPixelBufferPool?
var generation = 0
var srcW = 0, srcH = 0, outW = 0, outH = 0
var currentSurface: IOSurfaceRef?
var lastCopy: CVPixelBuffer?
var forceKey = true
var lastEncode = DispatchTime(uptimeNanoseconds: 0)
var lastKey = DispatchTime(uptimeNanoseconds: 0)
var pendingFrame = false
var sizeSent = false
var lastConfig: Data?
var keySent = false
var firstKeyWritten = false // never reset; the startup deadline checks it
var encodeErrorLogged = false
let start = DispatchTime.now()
var nFrames = 0, nKeys = 0, nBytes = 0, maxBytes = 0, nCallbacks = 0, nFrameCB = 0, nDamageCB = 0, nDropped = 0

let startCode = Data([0, 0, 0, 1])
let keyIntNs = UInt64(keyIntSec * 1_000_000_000)

@Sendable func setupEncoder(_ w: Int, _ h: Int) {
  if let old = session {
    VTCompressionSessionCompleteFrames(old, untilPresentationTimeStamp: .invalid)
    VTCompressionSessionInvalidate(old)
  }
  session = nil
  pool = nil
  generation += 1
  srcW = w
  srcH = h
  var tw = w, th = h
  if maxSide > 0 && max(w, h) > maxSide {
    let scale = Double(maxSide) / Double(max(w, h))
    tw = Int((Double(w) * scale).rounded())
    th = Int((Double(h) * scale).rounded())
  }
  tw &= ~1
  th &= ~1
  outW = tw
  outH = th

  let attrs: [CFString: Any] = [
    kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
    kCVPixelBufferWidthKey: tw,
    kCVPixelBufferHeightKey: th,
    kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary,
  ]
  var newPool: CVPixelBufferPool?
  CVPixelBufferPoolCreate(nil, [kCVPixelBufferPoolMinimumBufferCountKey: 4] as CFDictionary, attrs as CFDictionary, &newPool)
  pool = newPool
  if transfer == nil { VTPixelTransferSessionCreate(allocator: nil, pixelTransferSessionOut: &transfer) }
  if let transfer { VTSessionSetProperty(transfer, key: kVTPixelTransferPropertyKey_ScalingMode, value: kVTScalingMode_Normal) }

  var s: VTCompressionSession?
  var spec: [CFString: Any] = [kVTVideoEncoderSpecification_EnableHardwareAcceleratedVideoEncoder: true]
  if #available(macOS 11.3, *) { spec[kVTVideoEncoderSpecification_EnableLowLatencyRateControl] = true }
  var status = VTCompressionSessionCreate(
    allocator: nil, width: Int32(tw), height: Int32(th), codecType: kCMVideoCodecType_H264,
    encoderSpecification: spec as CFDictionary, imageBufferAttributes: nil, compressedDataAllocator: nil,
    outputCallback: nil, refcon: nil, compressionSessionOut: &s)
  var lowLatencyRC = status == noErr && spec.count > 1
  if status != noErr {
    // Low-latency rate control is not available on every encoder/size.
    status = VTCompressionSessionCreate(
      allocator: nil, width: Int32(tw), height: Int32(th), codecType: kCMVideoCodecType_H264,
      encoderSpecification: nil, imageBufferAttributes: nil, compressedDataAllocator: nil,
      outputCallback: nil, refcon: nil, compressionSessionOut: &s)
    lowLatencyRC = false
  }
  guard status == noErr, let s else {
    log(["event": "error", "message": "VTCompressionSessionCreate failed (\(status))"])
    finish(exitSetup)
  }
  let props: [CFString: Any] = [
    kVTCompressionPropertyKey_RealTime: true,
    kVTCompressionPropertyKey_AllowFrameReordering: false,
    kVTCompressionPropertyKey_ProfileLevel: kVTProfileLevel_H264_High_AutoLevel,
    kVTCompressionPropertyKey_H264EntropyMode: kVTH264EntropyMode_CABAC,
    kVTCompressionPropertyKey_AverageBitRate: bitrate,
    kVTCompressionPropertyKey_DataRateLimits: [bitrate * 2 / 8, 1] as CFArray,
    kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration: keyIntSec,
    kVTCompressionPropertyKey_MaxKeyFrameInterval: max(1, Int(keyIntSec * maxFps)),
    kVTCompressionPropertyKey_ExpectedFrameRate: maxFps,
  ]
  for (key, value) in props {
    let r = VTSessionSetProperty(s, key: key, value: value as CFTypeRef)
    if r != noErr { log(["event": "warn", "message": "encoder property rejected", "prop": key as String, "status": r]) }
  }
  VTCompressionSessionPrepareToEncodeFrames(s)
  session = s
  forceKey = true
  sizeSent = false
  keySent = false
  lastConfig = nil
  lastCopy = nil // old-size copy; the next snapshot of the new surface refills it
  log(["event": "size", "srcWidth": w, "srcHeight": h, "width": tw, "height": th, "lowLatencyRC": lowLatencyRC])
}

func parameterSets(_ fmt: CMFormatDescription) -> Data {
  var out = Data()
  var count = 0
  CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
    fmt, parameterSetIndex: 0, parameterSetPointerOut: nil, parameterSetSizeOut: nil,
    parameterSetCountOut: &count, nalUnitHeaderLengthOut: nil)
  for i in 0..<count {
    var ptr: UnsafePointer<UInt8>?
    var size = 0
    CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
      fmt, parameterSetIndex: i, parameterSetPointerOut: &ptr, parameterSetSizeOut: &size,
      parameterSetCountOut: nil, nalUnitHeaderLengthOut: nil)
    if let ptr {
      out.append(startCode)
      out.append(ptr, count: size)
    }
  }
  return out
}

// AVCC (4-byte length prefixes) -> Annex-B (4-byte start codes).
func annexB(_ block: CMBlockBuffer) -> Data? {
  var total = 0
  var dp: UnsafeMutablePointer<CChar>?
  guard CMBlockBufferGetDataPointer(
    block, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &total, dataPointerOut: &dp) == noErr,
    let dp
  else { return nil }
  var contiguous: Data
  if CMBlockBufferIsRangeContiguous(block, atOffset: 0, length: total) {
    contiguous = Data(bytesNoCopy: dp, count: total, deallocator: .none)
  } else {
    contiguous = Data(count: total)
    contiguous.withUnsafeMutableBytes { _ = CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: total, destination: $0.baseAddress!) }
  }
  var out = Data(capacity: total + 16)
  contiguous.withUnsafeBytes { (b: UnsafeRawBufferPointer) in
    var off = 0
    while off + 4 <= b.count {
      let length = Int(b[off]) << 24 | Int(b[off + 1]) << 16 | Int(b[off + 2]) << 8 | Int(b[off + 3])
      off += 4
      guard length > 0, off + length <= b.count else { break }
      out.append(startCode)
      out.append(contentsOf: b[off..<(off + length)])
      off += length
    }
  }
  return out
}

func emit(_ sbuf: CMSampleBuffer, _ gen: Int) { // on q
  guard gen == generation else { return } // output of an encoder replaced by a resize
  guard let block = CMSampleBufferGetDataBuffer(sbuf), let fmt = CMSampleBufferGetFormatDescription(sbuf) else { return }
  var isKey = true
  if let atts = CMSampleBufferGetSampleAttachmentsArray(sbuf, createIfNecessary: false) as? [[CFString: Any]],
     let first = atts.first, (first[kCMSampleAttachmentKey_NotSync] as? Bool) == true {
    isKey = false
  }
  if !isKey && !keySent {
    nDropped += 1
    return
  }
  guard let frame = annexB(block) else { return }
  if !sizeSent {
    var payload = Data(capacity: 8)
    withUnsafeBytes(of: UInt32(outW).bigEndian) { payload.append(contentsOf: $0) }
    withUnsafeBytes(of: UInt32(outH).bigEndian) { payload.append(contentsOf: $0) }
    writePacket(.size, payload)
    sizeSent = true
  }
  if isKey {
    let config = parameterSets(fmt)
    if config != lastConfig {
      writePacket(.config, config)
      lastConfig = config
    }
    keySent = true
    firstKeyWritten = true
    nKeys += 1
  }
  nFrames += 1
  nBytes += frame.count
  maxBytes = max(maxBytes, frame.count)
  writePacket(isKey ? .key : .delta, frame)
}

@Sendable func encode(_ pb: CVPixelBuffer) { // on q
  guard let s = session else { return }
  guard bufferFits(width: CVPixelBufferGetWidth(pb), height: CVPixelBufferGetHeight(pb), outW: outW, outH: outH) else { return }
  let now = DispatchTime.now()
  lastEncode = now
  if now.uptimeNanoseconds - lastKey.uptimeNanoseconds >= keyIntNs { forceKey = true }
  if forceKey { lastKey = now }
  let pts = CMTime(value: CMTimeValue(now.uptimeNanoseconds - start.uptimeNanoseconds), timescale: 1_000_000_000)
  let forced = forceKey
  let frameProps: CFDictionary? = forced ? [kVTEncodeFrameOptionKey_ForceKeyFrame: true] as CFDictionary : nil
  forceKey = false
  let gen = generation
  let status = VTCompressionSessionEncodeFrame(
    s, imageBuffer: pb, presentationTimeStamp: pts, duration: .invalid, frameProperties: frameProps,
    infoFlagsOut: nil
  ) { status, _, sbuf in
    if status == noErr, let sbuf {
      q.async { emit(sbuf, gen) }
    } else {
      q.async {
        guard shouldReforceKey(forced: forced, encodeOK: status == noErr, hasSample: sbuf != nil, sameGeneration: gen == generation)
        else { return }
        if status != noErr && !encodeErrorLogged {
          log(["event": "warn", "message": "encode failed", "status": status])
          encodeErrorLogged = true
        }
        forceKey = true
        // A lost forced key frame is retried by the idle timer on its next tick instead of after a full keyint.
        if forced { lastKey = DispatchTime(uptimeNanoseconds: 0) }
      }
    }
  }
  if status != noErr {
    forceKey = true
    if forced { lastKey = DispatchTime(uptimeNanoseconds: 0) }
    if !encodeErrorLogged { log(["event": "warn", "message": "encode failed", "status": status]); encodeErrorLogged = true }
  }
}

// Copy the framebuffer at callback time; the simulator keeps drawing into the shared surface.
@Sendable func snapshot() -> CVPixelBuffer? {
  guard let surf = currentSurface, let transfer, let pool else { return nil }
  var src: Unmanaged<CVPixelBuffer>?
  guard CVPixelBufferCreateWithIOSurface(nil, surf, nil, &src) == kCVReturnSuccess,
        let srcBuf = src?.takeRetainedValue()
  else { return nil }
  var dst: CVPixelBuffer?
  guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &dst) == kCVReturnSuccess, let dst else { return nil }
  var seed: UInt32 = 0
  IOSurfaceLock(surf, .readOnly, &seed)
  let status = VTPixelTransferSessionTransferImage(transfer, from: srcBuf, to: dst)
  IOSurfaceUnlock(surf, .readOnly, &seed)
  return status == noErr ? dst : nil
}

let minIntervalNs = UInt64(1_000_000_000 / maxFps)

func onFrame() { // on q
  nCallbacks += 1
  guard currentSurface != nil else { return }
  let elapsed = DispatchTime.now().uptimeNanoseconds - lastEncode.uptimeNanoseconds
  if elapsed < minIntervalNs {
    // Rate-limit, but never drop the last frame of a burst.
    if !pendingFrame {
      pendingFrame = true
      q.asyncAfter(deadline: lastEncode + .nanoseconds(Int(minIntervalNs))) {
        pendingFrame = false
        onFrame()
      }
    }
    return
  }
  if let pb = snapshot() {
    lastCopy = pb
    encode(pb)
  }
}

func onSurface(_ surf: IOSurfaceRef?) { // on q
  guard let surf else {
    currentSurface = nil
    return
  }
  currentSurface = surf
  let w = IOSurfaceGetWidth(surf), h = IOSurfaceGetHeight(surf)
  if w != srcW || h != srcH || session == nil { setupEncoder(w, h) }
  onFrame()
}

func requestKeyFrame() { // on q
  forceKey = true
  if let pb = lastCopy { encode(pb) }
}

// MARK: callbacks

let callbackID = NSUUID()
typealias SurfacesBlock = @convention(block) (AnyObject?, AnyObject?) -> Void
typealias VoidBlock = @convention(block) () -> Void
typealias ObjectBlock = @convention(block) (AnyObject?) -> Void
let surfacesBlock: SurfacesBlock = { primary, _ in
  let surf = surfaceRef(primary)
  q.async { onSurface(surf) }
}
let frameBlock: VoidBlock = {
  q.async {
    nFrameCB += 1
    onFrame()
  }
}
let damageBlock: ObjectBlock = { _ in
  q.async {
    nDamageCB += 1
    onFrame()
  }
}
let propertiesBlock: ObjectBlock = { _ in }

if api == "screen" {
  typealias F = @convention(c) (AnyObject, Selector, NSUUID, DispatchQueue, VoidBlock, SurfacesBlock, ObjectBlock) -> Void
  impl(display, screenSel, F.self)!(display, screenSel, callbackID, q, frameBlock, surfacesBlock, propertiesBlock)
} else {
  typealias S = @convention(c) (AnyObject, Selector, NSUUID, SurfacesBlock) -> Void
  typealias D = @convention(c) (AnyObject, Selector, NSUUID, ObjectBlock) -> Void
  impl(display, surfacesSel, S.self)!(display, surfacesSel, callbackID, surfacesBlock)
  impl(display, damageSel, D.self)!(display, damageSel, callbackID, damageBlock)
}
log(["event": "mode", "api": api])

func finish(_ code: Int32) -> Never {
  let names = api == "screen"
    ? ["unregisterScreenCallbacksWithUUID:"]
    : ["unregisterIOSurfacesChangeCallbackWithUUID:", "unregisterDamageRectanglesCallbackWithUUID:"]
  typealias F = @convention(c) (AnyObject, Selector, NSUUID) -> Void
  for name in names {
    let sel = NSSelectorFromString(name)
    impl(display, sel, F.self)?(display, sel, callbackID)
  }
  exit(code)
}

let initialSurface = surfaceRef(callObject(display, "framebufferSurface"))
q.async { onSurface(initialSurface) }
setupDone.signal()

// A booted device always has a framebuffer; without one the caller should fall back to another capture path.
q.asyncAfter(deadline: .now() + 10) {
  if missedFirstKeyDeadline(firstKeyWritten: firstKeyWritten) {
    log(["event": "error", "message": "no key frame encoded within 10 s"])
    finish(exitSetup)
  }
}

// MARK: timers, stdin, signals

let idleNs = UInt64(1_000_000_000 / idleFps)
let idleTimer = DispatchSource.makeTimerSource(queue: q)
idleTimer.schedule(deadline: .now() + .milliseconds(100), repeating: .milliseconds(100))
idleTimer.setEventHandler {
  guard let pb = lastCopy else { return }
  let now = DispatchTime.now().uptimeNanoseconds
  if now - lastEncode.uptimeNanoseconds >= idleNs || now - lastKey.uptimeNanoseconds >= keyIntNs { encode(pb) }
}
idleTimer.resume()

let statsTimer = DispatchSource.makeTimerSource(queue: q)
statsTimer.schedule(deadline: .now() + statsSec, repeating: statsSec)
statsTimer.setEventHandler {
  log([
    "event": "stats", "frames": nFrames, "keyframes": nKeys, "bytes": nBytes, "maxFrameBytes": maxBytes,
    "dropped": nDropped, "callbacks": nCallbacks, "frameCallbacks": nFrameCB, "damageCallbacks": nDamageCB,
  ])
}
statsTimer.resume()

let watchdog = DispatchSource.makeTimerSource(queue: q)
watchdog.schedule(deadline: .now() + 1, repeating: 1)
watchdog.setEventHandler {
  if let state = deviceState(), state != simDeviceStateBooted {
    log(["event": "error", "message": "device is no longer booted (state \(state))"])
    finish(exitNotBooted)
  }
}
watchdog.resume()

Thread.detachNewThread {
  while let line = readLine() {
    if line.trimmingCharacters(in: .whitespaces) == "k" { q.async { requestKeyFrame() } }
  }
}

var signalSources: [DispatchSourceSignal] = []
for sig in [SIGINT, SIGTERM] {
  signal(sig, SIG_IGN)
  let source = DispatchSource.makeSignalSource(signal: sig, queue: q)
  source.setEventHandler { finish(0) }
  source.resume()
  signalSources.append(source)
}

dispatchMain()
