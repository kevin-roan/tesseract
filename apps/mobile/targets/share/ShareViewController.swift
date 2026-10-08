import UIKit
import UniformTypeIdentifiers

private enum ShareContract {
  static let appGroup = "group.com.kevinroan.tesseract"
  static let sharedNotification = "com.kevinroan.tesseract.island.shared"
  static let inboxDirectory = "shared-inbox"
  static let manifestFile = "manifest.json"
  static let openURL = URL(string: "tesseract://island/share")!
}

private struct InboxItem: Codable {
  let id: String
  let kind: String
  let file: String?
  let text: String?
  let name: String
  let mimeType: String
  let sizeBytes: Int?
  let createdAt: String
}

final class ShareViewController: UIViewController {
  private var didProcess = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor.systemBackground
    let label = UILabel()
    label.text = "Sending to Tesseract…"
    label.font = UIFont.preferredFont(forTextStyle: .body)
    label.textColor = UIColor.secondaryLabel
    label.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !didProcess else { return }
    didProcess = true
    process()
  }

  private var inboxURL: URL? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: ShareContract.appGroup)?
      .appendingPathComponent(ShareContract.inboxDirectory, isDirectory: true)
  }

  private func process() {
    guard let inbox = inboxURL else {
      finish()
      return
    }
    try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)

    let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
      .flatMap { $0.attachments ?? [] }
    let group = DispatchGroup()
    let lock = NSLock()
    var items: [InboxItem] = []

    for provider in providers {
      group.enter()
      load(provider, into: inbox) { item in
        if let item {
          lock.lock()
          items.append(item)
          lock.unlock()
        }
        group.leave()
      }
    }

    group.notify(queue: .main) { [weak self] in
      guard let self else { return }
      self.appendToManifest(items, inbox: inbox)
      CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName(ShareContract.sharedNotification as CFString),
        nil,
        nil,
        true
      )
      self.openHostApp()
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
        self.finish()
      }
    }
  }

  private func load(_ provider: NSItemProvider, into inbox: URL, completion: @escaping (InboxItem?) -> Void) {
    if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
      provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] value, _ in
        completion(self?.storeImage(value, provider: provider, inbox: inbox))
      }
    } else if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
      provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { [weak self] value, _ in
        completion(self?.storeFileValue(value, inbox: inbox))
      }
    } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
      provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { value, _ in
        guard let url = value as? URL else {
          completion(nil)
          return
        }
        if url.isFileURL {
          completion(self.storeFile(url, inbox: inbox))
        } else {
          completion(Self.textItem(url.absoluteString, kind: "url", name: url.host ?? "link", mimeType: "text/uri-list"))
        }
      }
    } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
      provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { value, _ in
        let text: String?
        if let string = value as? String {
          text = string
        } else if let attributed = value as? NSAttributedString {
          text = attributed.string
        } else if let data = value as? Data {
          text = String(data: data, encoding: .utf8)
        } else {
          text = nil
        }
        guard let text else {
          completion(nil)
          return
        }
        completion(Self.textItem(text, kind: "text", name: "text.txt", mimeType: "text/plain"))
      }
    } else {
      completion(nil)
    }
  }

  private func storeImage(_ value: NSSecureCoding?, provider: NSItemProvider, inbox: URL) -> InboxItem? {
    if let url = value as? URL {
      return storeFile(url, inbox: inbox, kind: "image")
    }
    let id = UUID().uuidString
    if let image = value as? UIImage, let data = image.jpegData(compressionQuality: 0.9) {
      return write(data, id: id, fileName: "\(id).jpg", kind: "image", name: "image.jpg", mimeType: "image/jpeg", inbox: inbox)
    }
    if let data = value as? Data {
      let type = provider.registeredTypeIdentifiers.compactMap { UTType($0) }.first { $0.conforms(to: .image) }
      let ext = type?.preferredFilenameExtension ?? "png"
      let mime = type?.preferredMIMEType ?? "image/png"
      return write(data, id: id, fileName: "\(id).\(ext)", kind: "image", name: "image.\(ext)", mimeType: mime, inbox: inbox)
    }
    return nil
  }

  private func storeFileValue(_ value: NSSecureCoding?, inbox: URL) -> InboxItem? {
    guard let url = value as? URL else { return nil }
    return storeFile(url, inbox: inbox)
  }

  private func storeFile(_ url: URL, inbox: URL, kind: String = "file") -> InboxItem? {
    let id = UUID().uuidString
    let ext = url.pathExtension
    let fileName = ext.isEmpty ? id : "\(id).\(ext)"
    let destination = inbox.appendingPathComponent(fileName)
    let accessed = url.startAccessingSecurityScopedResource()
    defer {
      if accessed {
        url.stopAccessingSecurityScopedResource()
      }
    }
    do {
      try FileManager.default.copyItem(at: url, to: destination)
    } catch {
      return nil
    }
    let size = (try? FileManager.default.attributesOfItem(atPath: destination.path))?[.size] as? Int
    let type = UTType(filenameExtension: ext)
    let resolvedKind = kind == "file" && (type?.conforms(to: .image) ?? false) ? "image" : kind
    return InboxItem(
      id: id,
      kind: resolvedKind,
      file: fileName,
      text: nil,
      name: url.lastPathComponent,
      mimeType: type?.preferredMIMEType ?? "application/octet-stream",
      sizeBytes: size,
      createdAt: Self.now()
    )
  }

  private func write(_ data: Data, id: String, fileName: String, kind: String, name: String, mimeType: String, inbox: URL) -> InboxItem? {
    let destination = inbox.appendingPathComponent(fileName)
    do {
      try data.write(to: destination, options: .atomic)
    } catch {
      return nil
    }
    return InboxItem(
      id: id,
      kind: kind,
      file: fileName,
      text: nil,
      name: name,
      mimeType: mimeType,
      sizeBytes: data.count,
      createdAt: Self.now()
    )
  }

  private static func textItem(_ text: String, kind: String, name: String, mimeType: String) -> InboxItem {
    InboxItem(
      id: UUID().uuidString,
      kind: kind,
      file: nil,
      text: text,
      name: name,
      mimeType: mimeType,
      sizeBytes: text.utf8.count,
      createdAt: now()
    )
  }

  private static func now() -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: Date())
  }

  private func appendToManifest(_ items: [InboxItem], inbox: URL) {
    let manifest = inbox.appendingPathComponent(ShareContract.manifestFile)
    var existing: [InboxItem] = []
    if let data = try? Data(contentsOf: manifest),
       let parsed = try? JSONDecoder().decode([InboxItem].self, from: data) {
      existing = parsed
    }
    existing.append(contentsOf: items)
    if let data = try? JSONEncoder().encode(existing) {
      try? data.write(to: manifest, options: .atomic)
    }
  }

  private func openHostApp() {
    let url = ShareContract.openURL
    if #available(iOS 18.0, *), let context = extensionContext {
      context.open(url) { [weak self] success in
        if !success {
          self?.openViaResponderChain(url)
        }
      }
      return
    }
    openViaResponderChain(url)
  }

  private func openViaResponderChain(_ url: URL) {
    let selector = sel_registerName("openURL:")
    var responder: UIResponder? = self
    while let current = responder {
      if current.responds(to: selector) {
        current.perform(selector, with: url)
        return
      }
      responder = current.next
    }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }
}
