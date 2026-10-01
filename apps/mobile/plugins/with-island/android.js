const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

const permissions = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
];

module.exports = function withIslandAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    AndroidConfig.Permissions.ensurePermissions(mod.modResults, permissions);
    return mod;
  });
};
