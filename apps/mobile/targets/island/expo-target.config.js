/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "island",
  displayName: process.env.APP_VARIANT === "development" ? "Tesseract Island Dev" : "Tesseract Island",
  bundleIdentifier: ".island",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AppIntents"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.kevinroan.tesseract"],
  },
  colors: {
    $accent: "#EDEDED",
    $widgetBackground: "#0D0D0D",
  },
  images: {
    appIcon: "./assets/app-icon.png",
  },
};
