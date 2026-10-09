// Single source of truth: this file must stay byte-identical in modules/tesseract-island/ios/ and targets/island/.
import ActivityKit
import Foundation

struct IslandAttributes: ActivityAttributes {
  struct IslandRun: Codable, Hashable {
    let id: String
    let title: String
    let project: String?
    let state: String
    let startedAt: String
    let tokens: Int?
  }

  struct IslandCommand: Codable, Hashable {
    let id: String
    let label: String
    let project: String?
    let state: String
  }

  struct IslandUsage: Codable, Hashable {
    let todayTokens: Int
    let weekTokens: Int
    let runsToday: Int
    let messagesToday: Int
  }

  struct ContentState: Codable, Hashable {
    let sandboxId: String
    let sandboxName: String
    let runs: [IslandRun]
    let commands: [IslandCommand]
    let usage: IslandUsage
    let updatedAt: String
    /// Task the activity was switched to; the app fills it from the app group, so pushes may leave it out.
    var focusId: String?

    var runningRuns: [IslandRun] {
      runs.filter { $0.state == "running" }
    }
  }

  let sandboxId: String
  let sandboxName: String
}

enum IslandContract {
  static let appGroup = "group.com.kevinroan.tesseract"
  static let actionsKey = "island.actions"
  static let focusKey = "island.focus"
  static let actionNotification = "com.kevinroan.tesseract.island.action"
  static let focusNotification = "com.kevinroan.tesseract.island.focus"
  static let sharedNotification = "com.kevinroan.tesseract.island.shared"
  static let inboxDirectory = "shared-inbox"
  static let manifestFile = "manifest.json"

  static var containerURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
  }

  static var inboxURL: URL? {
    containerURL?.appendingPathComponent(inboxDirectory, isDirectory: true)
  }

  static func postDarwinNotification(_ name: String) {
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName(name as CFString),
      nil,
      nil,
      true
    )
  }

  static var focusId: String? {
    UserDefaults(suiteName: appGroup)?.string(forKey: focusKey)
  }

  static func setFocus(_ id: String) {
    UserDefaults(suiteName: appGroup)?.set(id, forKey: focusKey)
    postDarwinNotification(focusNotification)
  }

  static func appendAction(_ action: String, runId: String? = nil) {
    guard let defaults = UserDefaults(suiteName: appGroup) else { return }
    var queue: [[String: Any]] = []
    if let raw = defaults.string(forKey: actionsKey),
       let data = raw.data(using: .utf8),
       let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
      queue = parsed
    }
    var item: [String: Any] = ["action": action]
    if let runId {
      item["runId"] = runId
    }
    queue.append(item)
    if let data = try? JSONSerialization.data(withJSONObject: queue),
       let raw = String(data: data, encoding: .utf8) {
      defaults.set(raw, forKey: actionsKey)
    }
    postDarwinNotification(actionNotification)
  }

  static func drainActions() -> [[String: Any]] {
    guard let defaults = UserDefaults(suiteName: appGroup) else { return [] }
    defer { defaults.removeObject(forKey: actionsKey) }
    guard let raw = defaults.string(forKey: actionsKey),
          let data = raw.data(using: .utf8),
          let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      return []
    }
    return parsed
  }
}
