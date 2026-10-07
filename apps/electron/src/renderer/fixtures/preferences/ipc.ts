import type { ConnectionConfig } from "../../../shared/contracts/connection";
import { DEFAULT_SETTINGS } from "../../../shared/defaults";
import { isPreferencesRoute } from "../app-settings/data";
import { FIXTURE_SIDEBAR_WIDTH } from "../base/data";
import { isScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import { hostAccounts, LIVE_CONFIG, PREFERENCES_SCENARIOS, SAVED_CONFIG, snapshotFor } from "./data";

let saved: ConnectionConfig | null | undefined;

const gtkParity = () => isScenario(PREFERENCES_SCENARIOS.gtkParity) && isPreferencesRoute();
const live = () => isScenario(PREFERENCES_SCENARIOS.live) || gtkParity();
const settings = () => (gtkParity() ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, sidebarWidth: FIXTURE_SIDEBAR_WIDTH });

function current(): ConnectionConfig | null {
  if (saved !== undefined) return saved;
  if (isScenario(PREFERENCES_SCENARIOS.unconfigured)) return null;
  return live() ? LIVE_CONFIG : SAVED_CONFIG;
}

const fixtures = defineIpcFixtures({
  app: {
    settings,
    updateSettings: (patch) => ({ ...settings(), ...patch }),
  },
  connection: {
    load: () => snapshotFor(current(), live()),
    save: (input) => {
      saved = { apiUrl: input.apiUrl, token: input.token, name: input.name ?? null, pairingUrl: input.pairingUrl ?? null, source: "file" };
      return snapshotFor(saved, live());
    },
    forget: () => {
      saved = null;
      return snapshotFor(null, live());
    },
    discover: () => ({
      ok: true,
      config: LIVE_CONFIG,
      message: `Found ${LIVE_CONFIG.name} at ${LIVE_CONFIG.apiUrl}`,
      tried: [[LIVE_CONFIG.apiUrl, "ok"]],
    }),
  },
  claude: {
    hostAccounts: () => hostAccounts(Date.now()),
  },
});

export default fixtures;
