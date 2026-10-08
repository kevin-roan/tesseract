import Foundation

struct IslandInboxItem: Codable {
  let id: String
  let kind: String
  let file: String?
  let text: String?
  let name: String
  let mimeType: String
  let sizeBytes: Int?
  let createdAt: String
}

enum IslandInbox {
  static func read() -> [IslandInboxItem] {
    guard let inbox = IslandContract.inboxURL,
          let data = try? Data(contentsOf: inbox.appendingPathComponent(IslandContract.manifestFile)),
          let items = try? JSONDecoder().decode([IslandInboxItem].self, from: data) else {
      return []
    }
    return items
  }

  static func count() -> Int {
    read().count
  }

  static func take() throws -> [[String: Any]] {
    guard let inbox = IslandContract.inboxURL else {
      throw IslandException("App group container is unavailable")
    }
    let items = read()
    let destination = try IslandImaging.outputDirectory("shared")
    let manager = FileManager.default
    var result: [[String: Any]] = []
    for item in items {
      var uri: String? = nil
      if let file = item.file {
        let source = inbox.appendingPathComponent(file)
        let target = destination.appendingPathComponent("\(item.id)-\(file)")
        try? manager.removeItem(at: target)
        if manager.fileExists(atPath: source.path) {
          try manager.copyItem(at: source, to: target)
          uri = target.absoluteString
        }
      }
      result.append([
        "id": item.id,
        "kind": item.kind,
        "uri": orNull(uri),
        "text": orNull(item.text),
        "name": item.name,
        "mimeType": item.mimeType,
        "sizeBytes": orNull(item.sizeBytes),
        "createdAt": item.createdAt,
      ])
    }
    try? manager.removeItem(at: inbox)
    return result
  }

  private static func orNull(_ value: Any?) -> Any {
    value ?? NSNull()
  }
}
