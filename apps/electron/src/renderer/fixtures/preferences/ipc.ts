import type { ConnectionConfig } from "../../../shared/contracts/connection";
import type { MasterHostState } from "../../../shared/contracts/masterHost";
import { IpcError } from "../../../shared/ipc-types";
import { DEFAULT_SETTINGS } from "../../../shared/defaults";
import { isPreferencesRoute } from "../app-settings/data";
import { FIXTURE_SIDEBAR_WIDTH } from "../base/data";
import { isScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import {
  hostAccounts,
  LIVE_CONFIG,
  MASTER_HOST_LINK,
  MASTER_HOST_URL,
  MASTER_LINK_ERROR,
  MASTER_SANDBOX_URL,
  PREFERENCES_SCENARIOS,
  SAVED_CONFIG,
  snapshotFor,
} from "./data";

let saved: ConnectionConfig | null | undefined;
let masterLinked: boolean | undefined;

const gtkParity = () => isScenario(PREFERENCES_SCENARIOS.gtkParity) && isPreferencesRoute();
const live = () => isScenario(PREFERENCES_SCENARIOS.live) || gtkParity();
const settings = () => (gtkParity() ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, sidebarWidth: FIXTURE_SIDEBAR_WIDTH });

function current(): ConnectionConfig | null {
  if (saved !== undefined) return saved;
  if (isScenario(PREFERENCES_SCENARIOS.unconfigured)) return null;
  return live() ? LIVE_CONFIG : SAVED_CONFIG;
}

function masterState(): MasterHostState {
  if (isScenario(PREFERENCES_SCENARIOS.unconfigured) || gtkParity()) return { kind: "none" };
  const linked = masterLinked ?? !isScenario(PREFERENCES_SCENARIOS.masterUnlinked);
  if (!linked) return { kind: "unlinked", sandboxUrl: MASTER_SANDBOX_URL };
  const online = !isScenario(PREFERENCES_SCENARIOS.masterOffline);
  return { kind: "linked", sandboxUrl: MASTER_SANDBOX_URL, host: { link: MASTER_HOST_LINK, url: MASTER_HOST_URL, name: "studio-mac", online } };
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
  masterHost: {
    state: masterState,
    link: (link) => {
      if (!link.startsWith("tesseract://host?")) throw new IpcError("invalid_argument", MASTER_LINK_ERROR);
      masterLinked = true;
      return masterState();
    },
    unlink: () => {
      masterLinked = false;
      return masterState();
    },
  },
});

export default fixtures;
