// Pure encoder decisions, kept free of private-framework calls so tests/policy_tests.swift can check them.

/// The encoder answered a frame. A forced key frame that failed or was dropped (noErr with no sample buffer, which
/// VideoToolbox does under real-time/data-rate limits) must be forced again, or a joining viewer waits a full keyint.
/// A failed delta also forces a key frame so the stream restarts cleanly. Output of a replaced encoder is ignored.
func shouldReforceKey(forced: Bool, encodeOK: Bool, hasSample: Bool, sameGeneration: Bool) -> Bool {
  guard sameGeneration else { return false }
  if !encodeOK { return true }
  return forced && !hasSample
}

/// Only buffers of the current encoder size may be encoded; a copy from before a resize is stale.
func bufferFits(width: Int, height: Int, outW: Int, outH: Int) -> Bool {
  width == outW && height == outH
}

/// Startup deadline: without a key frame on stdout the daemon cannot show anything, so the helper must exit and let
/// it fall back to idb. A snapshot alone is not enough (the encoder may fail on every frame).
func missedFirstKeyDeadline(firstKeyWritten: Bool) -> Bool {
  !firstKeyWritten
}
