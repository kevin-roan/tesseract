import ExpoModulesCore
import Foundation

struct StartOptions: Record {
  @Field
  var controlUrl: String = ""

  @Field
  var authKey: String?

  @Field
  var hostname: String = ""
}

public class TesseractTailnetModule: Module {
  private static let statusEvent = "status"
  private static let stateDirName = "tailnet"
  private static let pollInterval: DispatchTimeInterval = .seconds(1)

  private let worker = DispatchQueue(label: "com.kevinroan.tesseract.tailnet.worker", qos: .userInitiated, attributes: .concurrent)
  private let pollQueue = DispatchQueue(label: "com.kevinroan.tesseract.tailnet.poll", qos: .utility)
  private var timer: DispatchSourceTimer?
  private var started = false
  private var foreground = true
  private var lastStatus: String?

  public func definition() -> ModuleDefinition {
    Name("TesseractTailnet")

    Events(Self.statusEvent)

    OnAppEntersForeground {
      self.pollQueue.async {
        self.foreground = true
        self.updatePolling()
      }
    }

    OnAppEntersBackground {
      self.pollQueue.async {
        self.foreground = false
        self.updatePolling()
      }
    }

    OnDestroy {
      self.pollQueue.sync {
        self.started = false
        self.updatePolling()
      }
    }

    Function("isLinked") { () -> Bool in
      TailnetLibrary.linked
    }

    AsyncFunction("start") { (options: StartOptions, promise: Promise) in
      self.perform(promise) {
        let stateDir = try Self.stateDirectory()
        try TailnetLibrary.start(
          stateDir: stateDir.path,
          controlUrl: options.controlUrl,
          authKey: options.authKey ?? "",
          hostname: options.hostname
        )
        self.setStarted(true)
        return nil
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      self.perform(promise) {
        self.setStarted(false)
        try TailnetLibrary.stop()
        self.pollQueue.async { self.emitStatus() }
        return nil
      }
    }

    AsyncFunction("logout") { (promise: Promise) in
      self.perform(promise) {
        self.setStarted(false)
        try TailnetLibrary.logout()
        self.pollQueue.async { self.emitStatus() }
        return nil
      }
    }

    AsyncFunction("status") { (promise: Promise) in
      self.perform(promise) { TailnetLibrary.statusJson() }
    }

    AsyncFunction("forward") { (host: String, port: Int, promise: Promise) in
      self.perform(promise) { try TailnetLibrary.forward(host: host, port: port) }
    }

    AsyncFunction("closeForward") { (host: String, port: Int, promise: Promise) in
      self.perform(promise) {
        TailnetLibrary.closeForward(host: host, port: port)
        return nil
      }
    }
  }

  private func perform(_ promise: Promise, _ body: @escaping () throws -> Any?) {
    worker.async {
      do {
        promise.resolve(try body())
      } catch let error as Exception {
        promise.reject(error)
      } catch {
        promise.reject(TailnetException(error.localizedDescription))
      }
    }
  }

  private func setStarted(_ value: Bool) {
    pollQueue.async {
      self.started = value
      self.updatePolling()
      if value {
        self.emitStatus()
      }
    }
  }

  private func updatePolling() {
    let shouldPoll = started && foreground
    if shouldPoll, timer == nil {
      let source = DispatchSource.makeTimerSource(queue: pollQueue)
      source.schedule(deadline: .now() + Self.pollInterval, repeating: Self.pollInterval)
      source.setEventHandler { [weak self] in
        self?.emitStatus()
      }
      source.resume()
      timer = source
    } else if !shouldPoll, let source = timer {
      source.cancel()
      timer = nil
    }
  }

  private func emitStatus() {
    let json = TailnetLibrary.statusJson()
    guard !json.isEmpty, json != lastStatus else {
      return
    }
    lastStatus = json
    sendEvent(Self.statusEvent, ["json": json])
  }

  private static func stateDirectory() throws -> URL {
    var url = try FileManager.default
      .url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent(stateDirName, isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try url.setResourceValues(values)
    return url
  }
}

final class TailnetException: Exception, @unchecked Sendable {
  private let message: String

  init(_ message: String, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.message = message
    super.init(file: file, line: line, function: function)
  }

  override var reason: String {
    message
  }
}
