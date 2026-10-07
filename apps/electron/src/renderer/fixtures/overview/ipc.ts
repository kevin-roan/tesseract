import { isPreferencesRoute } from "../app-settings/data";
import { FIXTURE_API_URL, FIXTURE_SANDBOX, FIXTURE_TOKEN } from "../base/data";
import preferencesFixtures from "../preferences/ipc";
import { isScenario } from "../scenario";
import { isGtkParity, PARITY_CONNECTION } from "../shell/parity";
import { defineIpcFixtures } from "../types";
import { EMPTY_METRICS, overviewMetricsCache } from "./data";
import { parityMetricsCache } from "./gtk-parity";
import { SCENARIOS } from "./http";

const CONFIG_FILE = "/home/dev/.config/monolith-desktop/config.json";

function overviewConnection() {
  return {
    config: isScenario(SCENARIOS.unconfigured)
      ? null
      : {
          apiUrl: FIXTURE_API_URL,
          token: isGtkParity() ? PARITY_CONNECTION.token : FIXTURE_TOKEN,
          name: FIXTURE_SANDBOX,
          pairingUrl: isGtkParity() ? PARITY_CONNECTION.pairingUrl : null,
          source: "file" as const,
        },
    configFile: CONFIG_FILE,
  };
}

export default defineIpcFixtures({
  connection: {
    load: () => {
      const preferencesLoad = preferencesFixtures.connection?.load;
      if (isGtkParity() && isPreferencesRoute() && preferencesLoad) return preferencesLoad();
      return overviewConnection();
    },
  },
  metrics: {
    load: () => (isScenario(SCENARIOS.collecting) ? EMPTY_METRICS : isGtkParity() ? parityMetricsCache() : overviewMetricsCache()),
    save: () => undefined,
  },
});
