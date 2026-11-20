const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod, withInfoPlist } = require("expo/config-plugins");

const CONFIG_NAME = "tesseract_network_security";
const LOOPBACK_DOMAINS = ["127.0.0.1", "localhost"];
const DEBUG_SOURCE_SETS = ["debug", "debugOptimized"];

const loopbackConfig = (baseCleartext) =>
  [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<network-security-config>",
    `  <base-config cleartextTrafficPermitted="${baseCleartext}" />`,
    '  <domain-config cleartextTrafficPermitted="true">',
    ...LOOPBACK_DOMAINS.map((domain) => `    <domain includeSubdomains="false">${domain}</domain>`),
    "  </domain-config>",
    "</network-security-config>",
    "",
  ].join("\n");

const writeConfig = (root, sourceSet, baseCleartext) => {
  const dir = path.join(root, "app", "src", sourceSet, "res", "xml");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${CONFIG_NAME}.xml`), loopbackConfig(baseCleartext));
};

const withTailnetIos = (config) =>
  withInfoPlist(config, (mod) => {
    const ats = mod.modResults.NSAppTransportSecurity ?? {};
    mod.modResults.NSAppTransportSecurity = { ...ats, NSAllowsLocalNetworking: true };
    return mod;
  });

const withTailnetAndroidFiles = (config) =>
  withDangerousMod(config, [
    "android",
    (mod) => {
      const root = mod.modRequest.platformProjectRoot;
      writeConfig(root, "main", false);
      DEBUG_SOURCE_SETS.forEach((sourceSet) => writeConfig(root, sourceSet, true));
      return mod;
    },
  ]);

const withTailnetAndroidManifest = (config) =>
  withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) application.$["android:networkSecurityConfig"] = `@xml/${CONFIG_NAME}`;
    return mod;
  });

module.exports = (config) => withTailnetAndroidManifest(withTailnetAndroidFiles(withTailnetIos(config)));
