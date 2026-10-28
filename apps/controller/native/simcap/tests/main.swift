// Tests for ../policy.swift. Build and run: see ../README.md. Exits 1 on the first failed expectation.
import Foundation

var failures = 0
func expect(_ ok: Bool, _ name: String, line: Int = #line) {
  if ok { print("ok   \(name)") } else { print("FAIL \(name) (line \(line))"); failures += 1 }
}

// A forced key frame that VideoToolbox drops (noErr, no sample buffer) is forced again.
expect(shouldReforceKey(forced: true, encodeOK: true, hasSample: false, sameGeneration: true), "dropped forced key is re-forced")
// A dropped delta frame is harmless.
expect(!shouldReforceKey(forced: false, encodeOK: true, hasSample: false, sameGeneration: true), "dropped delta is not re-forced")
// A delivered frame needs nothing.
expect(!shouldReforceKey(forced: true, encodeOK: true, hasSample: true, sameGeneration: true), "delivered key is not re-forced")
// Any encode error forces a key frame (previous behaviour, kept).
expect(shouldReforceKey(forced: false, encodeOK: false, hasSample: false, sameGeneration: true), "failed delta forces a key")
expect(shouldReforceKey(forced: true, encodeOK: false, hasSample: false, sameGeneration: true), "failed key is re-forced")
// Output of an encoder replaced by a resize does not touch the new session's state.
expect(!shouldReforceKey(forced: true, encodeOK: true, hasSample: false, sameGeneration: false), "stale generation is ignored")
expect(!shouldReforceKey(forced: true, encodeOK: false, hasSample: false, sameGeneration: false), "stale generation error is ignored")

// After rotation, a portrait copy must not be encoded into a landscape session.
expect(bufferFits(width: 1320, height: 2868, outW: 1320, outH: 2868), "current-size buffer fits")
expect(!bufferFits(width: 1320, height: 2868, outW: 2868, outH: 1320), "old-size buffer after rotation is rejected")
expect(!bufferFits(width: 1320, height: 2868, outW: 590, outH: 1280), "old-size buffer after rescale is rejected")

// The startup deadline depends on a key frame on stdout, not on a snapshot.
expect(missedFirstKeyDeadline(firstKeyWritten: false), "no key frame by the deadline exits")
expect(!missedFirstKeyDeadline(firstKeyWritten: true), "key frame written keeps running")

if failures > 0 { print("\(failures) failed"); exit(1) }
print("all passed")
