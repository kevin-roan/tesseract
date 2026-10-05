import Foundation
import SwiftUI

enum IslandTheme {
  static let background = Color(hex: 0x0D0D0D)
  static let button = Color(hex: 0x222222)
  static let text = Color(hex: 0xEDEDED)
  static let secondary = Color(hex: 0x8F8F8F)
  static let hairline = Color.white.opacity(0.14)
  static let keyline = Color(hex: 0x6B6B6B)
  static let appIcon = "appIcon"
}

enum IslandFont {
  static func regular(_ size: CGFloat) -> Font {
    .custom("Poppins-Regular", fixedSize: size)
  }

  static func medium(_ size: CGFloat) -> Font {
    .custom("Poppins-Medium", fixedSize: size)
  }

  static func semibold(_ size: CGFloat) -> Font {
    .custom("Poppins-SemiBold", fixedSize: size)
  }

  static func bold(_ size: CGFloat) -> Font {
    .custom("Poppins-Bold", fixedSize: size)
  }
}

private extension Color {
  init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
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
