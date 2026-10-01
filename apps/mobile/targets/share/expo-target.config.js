/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "share",
  name: "share",
  displayName: process.env.APP_VARIANT === "development" ? "Monolith Dev" : "Monolith",
  bundleIdentifier: ".share",
  deploymentTarget: "16.4",
  frameworks: ["UniformTypeIdentifiers"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.kevinbpract.theone"],
  },
};
