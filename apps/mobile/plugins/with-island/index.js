const { withEntitlementsPlist, withInfoPlist } = require("expo/config-plugins");

const APP_GROUP = "group.com.kevinroan.tesseract";
const APP_GROUPS_KEY = "com.apple.security.application-groups";

const withIslandIos = (config) => {
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    config.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return config;
  });
  return withEntitlementsPlist(config, (config) => {
    const groups = new Set(config.modResults[APP_GROUPS_KEY] ?? []);
    groups.add(APP_GROUP);
    config.modResults[APP_GROUPS_KEY] = [...groups];
    return config;
  });
};

module.exports = (config) => require("./android")(withIslandIos(config));
