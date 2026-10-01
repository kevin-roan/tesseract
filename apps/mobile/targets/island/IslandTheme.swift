import Foundation
import SwiftUI

enum IslandTheme {
  static let background = Color(red: 0.07, green: 0.07, blue: 0.08)
  static let card = Color(red: 0.13, green: 0.13, blue: 0.15)
  static let accent = Color(red: 0.78, green: 0.96, blue: 0.23)
  static let muted = Color.white.opacity(0.6)
  static let glyph = "sparkles"
}

enum IslandLinks {
  static let open = URL(string: "theone://island/open")!
  static let capture = URL(string: "theone://island/capture")!

  static func run(_ id: String) -> URL {
    URL(string: "theone://island/run/\(id)") ?? open
  }
}

enum IslandFormat {
  static func compact(_ value: Int) -> String {
    let number = Double(value)
    if number >= 1_000_000 {
      return trim(number / 1_000_000) + "M"
    }
    if number >= 1_000 {
      return trim(number / 1_000) + "k"
    }
    return "\(value)"
  }

  static func date(_ iso: String) -> Date {
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let plain = ISO8601DateFormatter()
    plain.formatOptions = [.withInternetDateTime]
    return withFraction.date(from: iso) ?? plain.date(from: iso) ?? Date()
  }

  private static func trim(_ value: Double) -> String {
    let text = String(format: "%.1f", value)
    return text.hasSuffix(".0") ? String(text.dropLast(2)) : text
  }
}
