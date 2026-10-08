import ActivityKit
import ExpoModulesCore
import Foundation

public class TesseractIslandModule: Module {
  private var activity: Activity<IslandAttributes>?
  private var hasActionListeners = false
  private var tokenTasks: [Task<Void, Never>] = []
  private var pushToStartTask: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("TesseractIsland")

    Events("onIslandAction", "onPushToken", "onSharedItems")

    OnCreate {
      self.startObservingDarwinNotifications()
      self.attachToExistingActivity()
      self.observePushToStartToken()
    }

    OnDestroy {
      self.stopObservingDarwinNotifications()
      self.tokenTasks.forEach { $0.cancel() }
      self.pushToStartTask?.cancel()
    }

    OnStartObserving("onIslandAction") {
      self.hasActionListeners = true
      self.flushActions()
    }

    OnStopObserving("onIslandAction") {
      self.hasActionListeners = false
    }

    Function("isLiveActivitySupported") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    Function("currentActivityId") { () -> String? in
      self.activity?.id
    }

    Function("canCaptureScreen") { (source: String) -> Bool in
      source == "app"
    }

    AsyncFunction("startActivity") { (state: [String: Any], promise: Promise) in
      let content: IslandAttributes.ContentState
      do {
        content = try IslandCoding.decodeState(state)
      } catch {
        promise.reject(error)
        return
      }
      Task {
        await self.endAllActivities()
        let attributes = IslandAttributes(sandboxId: content.sandboxId, sandboxName: content.sandboxName)
        do {
          let started = try Activity<IslandAttributes>.request(
            attributes: attributes,
            content: ActivityContent(state: content, staleDate: nil),
            pushType: .token
          )
          self.activity = started
          self.observe(started)
          promise.resolve(started.id)
        } catch {
          promise.reject(IslandException("Could not start the Live Activity: \(error.localizedDescription)"))
        }
      }
    }

    AsyncFunction("updateActivity") { (state: [String: Any], promise: Promise) in
      guard let activity = self.activity else {
        promise.reject(IslandException("No Live Activity is running"))
        return
      }
      let content: IslandAttributes.ContentState
      do {
        content = try IslandCoding.decodeState(state)
      } catch {
        promise.reject(error)
        return
      }
      Task {
        await activity.update(ActivityContent(state: content, staleDate: nil))
        promise.resolve()
      }
    }

    AsyncFunction("endActivity") { (promise: Promise) in
      Task {
        await self.endAllActivities()
        promise.resolve()
      }
    }

    AsyncFunction("drainActions") { () -> [[String: Any]] in
      IslandContract.drainActions()
    }

    AsyncFunction("captureScreen") { (source: String, promise: Promise) in
      guard source == "app" else {
        promise.reject(IslandException("iOS cannot capture other apps; only source \"app\" is supported"))
        return
      }
      do {
        promise.resolve(try IslandImaging.captureAppWindow().asDictionary)
      } catch {
        promise.reject(error)
      }
    }
    .runOnQueue(.main)

    AsyncFunction("cropImage") { (uri: String, rect: [String: Double]) throws -> [String: Any] in
      try IslandImaging.crop(uri: uri, rect: rect).asDictionary
    }

    AsyncFunction("recognizeText") { (uri: String) throws -> [String: Any] in
      try IslandImaging.recognizeText(uri: uri)
    }

    AsyncFunction("takeSharedItems") { () throws -> [[String: Any]] in
      try IslandInbox.take()
    }
  }

  private func endAllActivities() async {
    for existing in Activity<IslandAttributes>.activities {
      await existing.end(nil, dismissalPolicy: .immediate)
    }
    tokenTasks.forEach { $0.cancel() }
    tokenTasks = []
    activity = nil
  }

  private func attachToExistingActivity() {
    guard let existing = Activity<IslandAttributes>.activities.first else { return }
    activity = existing
    observe(existing)
  }

  private func observe(_ activity: Activity<IslandAttributes>) {
    let id = activity.id
    tokenTasks.append(Task { [weak self] in
      for await token in activity.pushTokenUpdates {
        self?.sendEvent("onPushToken", [
          "kind": "activity",
          "token": IslandCoding.hex(token),
          "activityId": id,
        ])
      }
    })
    tokenTasks.append(Task { [weak self] in
      for await state in activity.activityStateUpdates {
        if state == .ended || state == .dismissed {
          if self?.activity?.id == id {
            self?.activity = nil
          }
        }
      }
    })
  }

  private func observePushToStartToken() {
    guard #available(iOS 17.2, *) else { return }
    pushToStartTask = Task { [weak self] in
      for await token in Activity<IslandAttributes>.pushToStartTokenUpdates {
        self?.sendEvent("onPushToken", [
          "kind": "push-to-start",
          "token": IslandCoding.hex(token),
          "activityId": nil,
        ])
      }
    }
  }

  private func flushActions() {
    guard hasActionListeners else { return }
    for item in IslandContract.drainActions() {
      sendEvent("onIslandAction", item.mapValues { Optional($0) })
    }
  }

  private func startObservingDarwinNotifications() {
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    let observer = Unmanaged.passUnretained(self).toOpaque()
    let callback: CFNotificationCallback = { _, observer, name, _, _ in
      guard let observer, let name else { return }
      let module = Unmanaged<TesseractIslandModule>.fromOpaque(observer).takeUnretainedValue()
      module.handleDarwinNotification(name.rawValue as String)
    }
    for name in [IslandContract.actionNotification, IslandContract.sharedNotification] {
      CFNotificationCenterAddObserver(center, observer, callback, name as CFString, nil, .deliverImmediately)
    }
  }

  private func stopObservingDarwinNotifications() {
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    CFNotificationCenterRemoveEveryObserver(center, Unmanaged.passUnretained(self).toOpaque())
  }

  private func handleDarwinNotification(_ name: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      switch name {
      case IslandContract.actionNotification:
        self.flushActions()
      case IslandContract.sharedNotification:
        self.sendEvent("onSharedItems", ["count": IslandInbox.count()])
      default:
        break
      }
    }
  }
}

final class IslandException: Exception, @unchecked Sendable {
  private let message: String

  init(_ message: String, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.message = message
    super.init(file: file, line: line, function: function)
  }

  override var reason: String {
    message
  }
}

enum IslandCoding {
  static func decodeState(_ state: [String: Any]) throws -> IslandAttributes.ContentState {
    guard JSONSerialization.isValidJSONObject(state) else {
      throw IslandException("Island state is not JSON serializable")
    }
    let data = try JSONSerialization.data(withJSONObject: state)
    do {
      return try JSONDecoder().decode(IslandAttributes.ContentState.self, from: data)
    } catch {
      throw IslandException("Invalid island state: \(error.localizedDescription)")
    }
  }

  static func hex(_ data: Data) -> String {
    data.map { String(format: "%02x", $0) }.joined()
  }
}
