import Foundation
import UIKit
import Vision

struct IslandImage {
  let uri: String
  let width: Int
  let height: Int

  var asDictionary: [String: Any] {
    ["uri": uri, "width": width, "height": height]
  }
}

enum IslandImaging {
  static func captureAppWindow() throws -> IslandImage {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let windows = scenes.flatMap { $0.windows }
    guard let window = windows.first(where: { $0.isKeyWindow }) ?? windows.first else {
      throw IslandException("No window to capture")
    }
    let format = UIGraphicsImageRendererFormat()
    format.scale = window.screen.scale
    let renderer = UIGraphicsImageRenderer(bounds: window.bounds, format: format)
    let image = renderer.image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    return try write(image, prefix: "capture")
  }

  static func crop(uri: String, rect: [String: Double]) throws -> IslandImage {
    let image = try load(uri)
    guard let cgImage = image.cgImage else {
      throw IslandException("Image has no bitmap data")
    }
    let bounds = CGRect(x: 0, y: 0, width: cgImage.width, height: cgImage.height)
    let requested = CGRect(
      x: rect["x"] ?? 0,
      y: rect["y"] ?? 0,
      width: rect["width"] ?? 0,
      height: rect["height"] ?? 0
    )
    let target = requested.intersection(bounds).integral
    guard !target.isEmpty, let cropped = cgImage.cropping(to: target) else {
      throw IslandException("Crop rectangle is outside the image")
    }
    return try write(UIImage(cgImage: cropped), prefix: "crop")
  }

  static func recognizeText(uri: String) throws -> [String: Any] {
    let image = try load(uri)
    guard let cgImage = image.cgImage else {
      throw IslandException("Image has no bitmap data")
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])
    let width = Double(cgImage.width)
    let height = Double(cgImage.height)
    let observations = request.results ?? []
    let blocks: [[String: Any]] = observations
      .compactMap { observation -> [String: Any]? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return [
          "text": candidate.string,
          "x": box.minX * width,
          "y": (1 - box.maxY) * height,
          "width": box.width * width,
          "height": box.height * height,
        ]
      }
      .sorted { lhs, rhs in
        let ly = lhs["y"] as? Double ?? 0
        let ry = rhs["y"] as? Double ?? 0
        if abs(ly - ry) > 1 {
          return ly < ry
        }
        return (lhs["x"] as? Double ?? 0) < (rhs["x"] as? Double ?? 0)
      }
    let text = blocks.compactMap { $0["text"] as? String }.joined(separator: "\n")
    return ["text": text, "blocks": blocks]
  }

  static func load(_ uri: String) throws -> UIImage {
    let path = URL(string: uri)?.path ?? uri
    guard let image = UIImage(contentsOfFile: path) else {
      throw IslandException("Could not read image at \(uri)")
    }
    return normalized(image)
  }

  private static func normalized(_ image: UIImage) -> UIImage {
    guard image.imageOrientation != .up || image.scale != 1 else { return image }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let size = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
  }

  static func outputDirectory(_ name: String) throws -> URL {
    guard let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      throw IslandException("Caches directory is unavailable")
    }
    let directory = caches.appendingPathComponent(name, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private static func write(_ image: UIImage, prefix: String) throws -> IslandImage {
    guard let data = image.pngData() else {
      throw IslandException("Could not encode image as PNG")
    }
    let url = try outputDirectory("island").appendingPathComponent("\(prefix)-\(UUID().uuidString).png")
    try data.write(to: url, options: .atomic)
    let width = Int((image.size.width * image.scale).rounded())
    let height = Int((image.size.height * image.scale).rounded())
    return IslandImage(uri: url.absoluteString, width: width, height: height)
  }
}
