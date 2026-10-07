import type { ConnectionConfig, ConnectionSnapshot } from "../../../shared/contracts/connection";
import type { HostClaudeState } from "../../../shared/contracts/claude";
import { FIXTURE_API_URL, FIXTURE_SANDBOX, FIXTURE_TOKEN } from "../base/data";

export const PREFERENCES_SCENARIOS = {
  live: "preferences-live",
  unconfigured: "preferences-unconfigured",
  outdated: "preferences-outdated",
  geminiSaved: "preferences-gemini-saved",
  gtkParity: "gtk-parity",
} as const;

export const GTK_PARITY_DEFAULT_ACCOUNT = "claude-work";

const HOST_HOME = "/tmp/monolith-test-prefs-home";
const LIVE_CONFIG_FILE = "/tmp/monolith-test-prefs-cfg/config.json";
const DEFAULT_CONFIG_FILE = "/home/dev/.config/monolith-desktop/config.json";
const EXPIRY_LEAD_MS = 2 * 60 * 60 * 1000 - 30_000;

export const LIVE_CONFIG: ConnectionConfig = {
  apiUrl: "http://172.22.0.2:7700",
  token: "fixture-live-token-0123456789",
  name: FIXTURE_SANDBOX,
  pairingUrl: "https://theone-sandbox.tail511d9d.ts.net",
  source: "docker",
  container: "theone-sandbox",
};

export const SAVED_CONFIG: ConnectionConfig = {
  apiUrl: FIXTURE_API_URL,
  token: FIXTURE_TOKEN,
  name: FIXTURE_SANDBOX,
  pairingUrl: null,
  source: "file",
};

export function snapshotFor(config: ConnectionConfig | null, live: boolean): ConnectionSnapshot {
  return { config, configFile: live ? LIVE_CONFIG_FILE : DEFAULT_CONFIG_FILE };
}

export function hostAccounts(now: number): HostClaudeState[] {
  return [
    {
      id: "claude",
      configDir: `${HOST_HOME}/.claude`,
      primary: true,
      login: "signed-in",
      email: "you@example.com",
      displayName: "You",
      organization: "Example Org",
      subscriptionType: "max",
      expiresAt: now + EXPIRY_LEAD_MS,
      settings: { settingsJson: true, claudeMd: true, skills: 2, agents: 0, commands: 0, outputStyles: 0 },
    },
    {
      id: "claude-work",
      configDir: `${HOST_HOME}/.claude-work`,
      primary: false,
      login: "signed-in",
      email: "work@example.com",
      displayName: "Work",
      organization: "Example Work",
      subscriptionType: "team",
      expiresAt: now + EXPIRY_LEAD_MS,
      settings: { settingsJson: true, claudeMd: false, skills: 0, agents: 1, commands: 3, outputStyles: 0 },
    },
  ];
}
