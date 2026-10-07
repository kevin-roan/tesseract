import type { AvdInfo, EmulatorState } from "../../../shared/contracts/android";
import type { CliInstallStatus } from "../../../shared/contracts/app";
import type { HostShellState } from "../../../shared/contracts/hostShell";
import type { SandboxStackConfig, SandboxStackStatus, SetupChoices } from "../../../shared/contracts/sandbox";
import type { UpdateState } from "../../../shared/contracts/updates";
import { SEARCH_PARAM } from "../../../shared/routes";
import { AVD_HOME, AVDS } from "../onboarding-android/data";

export const SETTINGS_SCENARIOS = {
  hostStopped: "settings-host-stopped",
  hostRunning: "settings-host-running",
  hostFailed: "settings-host-failed",
  hostNoPin: "settings-host-no-pin",
  sandboxStopped: "settings-sandbox-stopped",
  sandboxUnconfigured: "settings-sandbox-unconfigured",
  sandboxBuilding: "settings-sandbox-building",
  emulatorRunning: "settings-emulator-running",
  updateAvailable: "settings-update-available",
  updateDownloading: "settings-update-downloading",
  updateReady: "settings-update-ready",
  cliInstalled: "settings-cli-installed",
  cliMissing: "settings-cli-missing",
} as const;

export function isPreferencesRoute(): boolean {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  const hash = globalThis.location?.hash ?? "";
  const query = hash.indexOf("?");
  if (query !== -1) new URLSearchParams(hash.slice(query + 1)).forEach((value, key) => params.set(key, value));
  return params.has(SEARCH_PARAM.preferences);
}

export const HOST_URL = "https://archlinux.tail511d9d.ts.net:8443";

export const HOST_LOG: readonly string[] = [
  "host shell: loaded token from /home/dev/.local/state/theone/host-shell/token",
  "host shell: tailscale serve https:8443 -> http://127.0.0.1:7701",
  "host shell listening on 127.0.0.1:7701",
  "GET /v1/health 200 0.4ms",
  "POST /v1/session 201 12.1ms (pin ok)",
  "WS /v1/terminal opened (cols 120, rows 36)",
];

export function hostShellState(scenario: string | null): HostShellState {
  const pairing = {
    link: `theone://host?url=${encodeURIComponent(HOST_URL)}&token=fixture-host-token&name=archlinux`,
    url: HOST_URL,
    name: "archlinux",
    pinSet: scenario !== SETTINGS_SCENARIOS.hostNoPin,
  };
  const base: HostShellState = { status: "external", pairing, error: null, log: [], autostart: false, sessionExpiresAt: null };
  switch (scenario) {
    case SETTINGS_SCENARIOS.hostStopped:
      return { ...base, status: "stopped", pairing: { ...pairing } };
    case SETTINGS_SCENARIOS.hostRunning:
      return { ...base, status: "running", log: [...HOST_LOG], autostart: true };
    case SETTINGS_SCENARIOS.hostFailed:
      return { ...base, status: "failed", error: "address already in use 127.0.0.1:7701", log: [...HOST_LOG.slice(0, 2), "error: listen EADDRINUSE 127.0.0.1:7701"] };
    default:
      return base;
  }
}

export const SETTINGS_CHOICES: SetupChoices = {
  mode: "local",
  tsAuthKey: "",
  tailnetDomain: "",
  hostname: "theone-sandbox",
  bindAddr: "",
  components: ["android", "flutter", "whisper"],
  whisperModels: ["base", "small"],
  flutterVersion: "3.47.5",
  cpus: 4,
  memoryGb: 8,
  timeZone: "UTC",
  project: "theone",
  image: "theone/sandbox:latest",
  controllerPort: 7700,
  vncPort: 5901,
  claudeCodeVersion: "latest",
  hostClaudeDir: "/home/dev/.claude",
  dind: false,
  useExistingImage: false,
};

export const SANDBOX_STACK: SandboxStackConfig = {
  envFile: "/home/dev/.config/Monolith/sandbox/.env",
  project: "theone",
  mode: "local",
  image: "theone/sandbox:latest",
  builtAt: "2026-10-04T18:12:00Z",
  components: ["android", "flutter", "whisper"],
};

export function sandboxStatus(running: boolean): SandboxStackStatus {
  const state = running ? "running" : "exited";
  return {
    configured: true,
    project: "theone",
    services: [
      { service: "sandbox", container: "theone-sandbox-1", state, health: running ? "healthy" : null },
      { service: "tailscale", container: "theone-tailscale-1", state, health: null },
    ],
  };
}

export const UNCONFIGURED_STATUS: SandboxStackStatus = { configured: false, project: null, services: [] };

export const SANDBOX_LOG: readonly string[] = [
  "Container theone-sandbox-1  Running",
  "theone-sandbox-1  | controller: listening on 0.0.0.0:7700",
  "theone-sandbox-1  | xvnc: display :1 1600x900",
];

export const SETTINGS_AVDS: AvdInfo[] = [
  ...AVDS,
  { name: "Pixel_8_API_35", path: `${AVD_HOME}/Pixel_8_API_35.avd`, target: "android-35", abi: "x86_64" },
];

export function emulatorState(scenario: string | null): EmulatorState {
  if (scenario === SETTINGS_SCENARIOS.emulatorRunning) return { kind: "running", avd: "Monolith_API_36", serial: "emulator-5554" };
  return { kind: "stopped" };
}

export function updateState(scenario: string | null): UpdateState {
  switch (scenario) {
    case SETTINGS_SCENARIOS.updateAvailable:
      return { kind: "available", version: "0.4.0", notes: "Faster sandbox builds and an Android SDK manager in Settings." };
    case SETTINGS_SCENARIOS.updateDownloading:
      return { kind: "downloading", version: "0.4.0", progress: { received: 61_400_000, total: 148_000_000, bytesPerSecond: 8_200_000 } };
    case SETTINGS_SCENARIOS.updateReady:
      return { kind: "ready", version: "0.4.0" };
    default:
      return { kind: "up-to-date", checkedAt: "2026-10-06T20:48:00Z" };
  }
}

export function cliStatus(scenario: string | null): CliInstallStatus {
  const binaryPath = "/opt/Monolith/resources/bin/monolith";
  if (scenario === SETTINGS_SCENARIOS.cliMissing) return { state: "missing", binaryPath, linkPath: null, message: null };
  if (scenario === SETTINGS_SCENARIOS.cliInstalled) return { state: "installed", binaryPath, linkPath: "/usr/bin/monolith", message: null };
  return { state: "installed", binaryPath, linkPath: "/home/dev/.local/bin/monolith", message: null };
}
