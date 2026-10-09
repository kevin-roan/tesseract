import AppIntents
import Foundation

struct StopRunIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Stop run"
  static let description = IntentDescription("Stops a running Tesseract run.")

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
  static let description = IntentDescription("Opens Tesseract and captures the screen.")
  static let openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    IslandContract.appendAction("capture")
    return .result()
  }
}

struct ShowTaskIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Show task"
  static let description = IntentDescription("Switches the Live Activity to another running task.")

  @Parameter(title: "Task")
  var taskId: String

  init() {}

  init(taskId: String) {
    self.taskId = taskId
  }

  func perform() async throws -> some IntentResult {
    IslandContract.setFocus(taskId)
    return .result()
  }
}
