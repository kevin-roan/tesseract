import type { WindowState } from "../../../shared/contracts/window";
import { DEFAULT_SETTINGS } from "../../../shared/defaults";
import { defineIpcFixtures } from "../types";
import { FIXTURE_API_URL, FIXTURE_SANDBOX, FIXTURE_SIDEBAR_WIDTH, FIXTURE_TOKEN } from "./data";

const FIXTURE_SETTINGS = { ...DEFAULT_SETTINGS, sidebarWidth: FIXTURE_SIDEBAR_WIDTH };

const windowState: WindowState = {
  maximized: false,
  fullscreen: false,
  focused: true,
  visible: true,
  zoom: 1,
  systemDark: true,
};

export default defineIpcFixtures({
  app: {
    settings: () => FIXTURE_SETTINGS,
    updateSettings: (patch) => ({ ...FIXTURE_SETTINGS, ...patch }),
    rendererIdle: () => undefined,
    paths: () => ({
      configFile: "/home/dev/.config/tesseract-desktop/config.json",
      userData: "/home/dev/.config/Tesseract",
      logs: "/home/dev/.config/Tesseract/logs",
      stateDir: "/home/dev/.local/state/tesseract",
      cacheDir: "/home/dev/.cache/tesseract-desktop",
    }),
    cliStatus: () => ({ state: "unsupported", binaryPath: null, linkPath: null, message: null }),
  },
  window: {
    state: () => windowState,
  },
  tray: {
    state: () => ({ attached: false, tooltip: "Tesseract" }),
    setStatus: (label) => ({ attached: false, tooltip: `Tesseract · ${label}` }),
  },
  connection: {
    load: () => ({
      config: { apiUrl: FIXTURE_API_URL, token: FIXTURE_TOKEN, name: FIXTURE_SANDBOX, pairingUrl: null, source: "file" },
      configFile: "/home/dev/.config/tesseract-desktop/config.json",
    }),
  },
  metrics: {
    load: () => ({ version: 1, sandboxes: {} }),
    save: () => undefined,
  },
  syncback: {
    state: () => ({ revision: 0, busy: [] }),
    links: () => [],
  },
  updates: {
    state: () => ({ kind: "unsupported", reason: "Fixture mode" }),
  },
});
