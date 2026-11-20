import Foundation
#if canImport(Tailnet)
import Tailnet
#endif

enum TailnetLibrary {
  static let missing =
    "This build has no tailnet library. Run native/tailnet/scripts/build-ios.sh on macOS, pod install and rebuild the app."

  #if canImport(Tailnet)
  static let linked = true

  static func start(stateDir: String, controlUrl: String, authKey: String, hostname: String) throws {
    var error: NSError?
    if !TailnetStart(stateDir, controlUrl, authKey, hostname, &error) {
      throw error ?? TailnetException("The tailnet node did not start")
    }
  }

  static func stop() throws {
    var error: NSError?
    if !TailnetStop(&error), let error {
      throw error
    }
  }

  static func logout() throws {
    var error: NSError?
    if !TailnetLogout(&error), let error {
      throw error
    }
  }

  static func statusJson() -> String {
    let json: String? = TailnetStatusJSON()
    return json ?? ""
  }

  static func forward(host: String, port: Int) throws -> Int {
    var local = 0
    var error: NSError?
    if !TailnetForward(host, port, &local, &error) {
      throw error ?? TailnetException("Could not forward to \(host):\(port)")
    }
    return local
  }

  static func closeForward(host: String, port: Int) {
    TailnetCloseForward(host, port)
  }
  #else
  static let linked = false

  static func start(stateDir: String, controlUrl: String, authKey: String, hostname: String) throws {
    throw TailnetException(missing)
  }

  static func stop() throws {}

  static func logout() throws {}

  static func statusJson() -> String {
    ""
  }

  static func forward(host: String, port: Int) throws -> Int {
    throw TailnetException(missing)
  }

  static func closeForward(host: String, port: Int) {}
  #endif
}
