import AppIntents
import Foundation

struct StopRunIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Stop run"
  static let description = IntentDescription("Stops a running Monolith run.")

  @Parameter(title: "Run")
  var runId: String

  init() {}

  init(runId: String) {
    self.runId = runId
  }

  func perform() async throws -> some IntentResult {
    IslandContract.appendAction("stop", runId: runId)
    return .result()
  }
}

struct CaptureIntent: AppIntent {
  static let title: LocalizedStringResource = "Capture"
  static let description = IntentDescription("Opens Monolith and captures the screen.")
  static let openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    IslandContract.appendAction("capture")
    return .result()
  }
}
