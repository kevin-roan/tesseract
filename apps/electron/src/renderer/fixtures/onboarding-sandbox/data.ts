import type { DockerReport } from "../../../shared/contracts/docker";
import type { BuildPhase, ExistingSandbox, SetupChoices, ValidationIssue } from "../../../shared/contracts/sandbox";

const GB = 1e9;

export const SANDBOX_SCENARIOS = {
  existingRunning: "sandbox-existing",
  existingStopped: "sandbox-stopped",
  imageOnly: "sandbox-image",
  tailscale: "sandbox-tailscale",
  desktop: "sandbox-desktop",
  lowDisk: "sandbox-low-disk",
  building: "sandbox-building",
  waiting: "sandbox-waiting",
  failed: "sandbox-failed",
  done: "sandbox-done",
  simulateFailure: "sandbox-simulate-failure",
} as const;

export const FIXTURE_NOW = Date.parse("2026-10-06T21:00:00Z");

export const ENGINE_REPORT: DockerReport = {
  cli: { path: "/usr/bin/docker", version: "28.5.1" },
  daemon: "reachable",
  daemonError: null,
  kind: "engine",
  context: "default",
  server: {
    version: "28.5.1",
    os: "linux",
    arch: "x86_64",
    ncpu: 16,
    memBytes: 32 * 1024 ** 3,
    rootDir: "/var/lib/docker",
    rootless: false,
  },
  compose: "2.40.0",
  buildx: "0.29.1",
  linux: {
    inDockerGroup: true,
    socketGroup: "docker",
    systemd: true,
    serviceActive: true,
  },
  checks: [],
};

export const DESKTOP_REPORT: DockerReport = {
  ...ENGINE_REPORT,
  kind: "desktop",
  context: "desktop-linux",
  server: {
    ...ENGINE_REPORT.server!,
    ncpu: 8,
    memBytes: 12 * 1024 ** 3,
    rootDir: "/var/lib/docker",
  },
};

export const NO_EXISTING: ExistingSandbox = { container: null, image: null };

const IMAGE: NonNullable<ExistingSandbox["image"]> = {
  ref: "theone/sandbox:latest",
  sizeBytes: 7.3 * GB,
  version: "0.1.0",
  createdAt: "2026-10-04T18:12:00Z",
};

export const EXISTING_RUNNING: ExistingSandbox = {
  container: {
    name: "theone-sandbox-1",
    state: "running",
    image: "theone/sandbox:latest",
    configFiles: ["/home/dev/theone/infra/compose/compose.yml", "/home/dev/theone/infra/compose/compose.local.yml"],
    workingDir: "/home/dev/theone/infra/compose",
  },
  image: IMAGE,
};

export const EXISTING_STOPPED: ExistingSandbox = {
  container: { ...EXISTING_RUNNING.container!, state: "stopped" },
  image: IMAGE,
};

export const IMAGE_ONLY: ExistingSandbox = { container: null, image: IMAGE };

export const BUILD_LOG: readonly string[] = [
  "#1 [internal] load build definition from Dockerfile",
  "#1 transferring dockerfile: 14.21kB done",
  "#2 resolve image config for docker-image://docker.io/docker/dockerfile:1",
  "#4 [base 1/6] FROM docker.io/library/debian:trixie-slim",
  "#4 CACHED",
  "#5 [controller-build 3/7] RUN bun install --frozen-lockfile --filter @theone/controller",
  "#5 0.412 bun install v1.3.2",
  "#5 9.870 + 412 packages installed [9.46s]",
  "#5 DONE 10.2s",
  "#9 [desktop 2/5] RUN apt-get install -y --no-install-recommends chromium xvfb tigervnc-standalone-server ffmpeg",
  "#9 12.31 Get:118 http://deb.debian.org/debian trixie/main amd64 chromium amd64 141.0.7390.65-1 [78.4 MB]",
  "#9 31.07 Unpacking chromium (141.0.7390.65-1) ...",
  '#12 [android-sdk 2/4] RUN sdkmanager --install "platform-tools" "platforms;android-36" "build-tools;36.0.0"',
  "#12 41.88 [=======================================] 100% Unzipping... build-tools/36.0.0",
];

export const BUILDING_PHASE: BuildPhase = {
  kind: "building",
  fraction: 0.42,
  step: '[android-sdk 2/4] RUN sdkmanager --install "platform-tools" "platforms;android-36"',
  cachedSteps: 9,
  doneSteps: 23,
  totalSteps: 54,
  bytes: { current: 412e6, total: 1.9e9 },
};

export const FAILED_PHASE: BuildPhase = {
  kind: "failed",
  phase: "health",
  message: "The controller did not answer /v1/health within 180 s.",
};

export const DONE_PHASE: BuildPhase = {
  kind: "done",
  apiUrl: "http://127.0.0.1:7700",
  imageId: "sha256:5e1d0c2a9b7f",
};

export const SIMULATED_STEPS: readonly string[] = [
  "[controller-build 3/7] RUN bun install --frozen-lockfile --filter @theone/controller",
  "[desktop 2/5] RUN apt-get install -y chromium xvfb tigervnc-standalone-server ffmpeg",
  "[electron 3/4] RUN apt-get install -y wine64 wine32",
  "[android-sdk 2/4] RUN sdkmanager --install platform-tools platforms;android-36",
  "[flutter 2/3] RUN flutter precache --web --linux",
  "[whisper 4/5] RUN cmake --build build -j",
  "[sandbox 6/6] COPY --from=controller-build /out /opt/theone",
];

export const SIMULATION_TICK_MS = 450;
export const SIMULATED_TOTAL_STEPS = 54;

const PROJECT = /^[a-z0-9][a-z0-9_-]*$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const HOSTNAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const MESSAGES = {
  project: "Use lowercase letters, digits, '-' and '_'",
  port: "Use a port between 1 and 65535",
  portsClash: "The VNC port must differ from the controller port",
  tailnetDomainRequired: "TS_TAILNET_DOMAIN is required in tailscale mode (e.g. tail1234.ts.net, see infra/compose/.env.example)",
  tailnetDomain: "Use a tailnet domain like tail1234.ts.net",
  hostname: "Use lowercase letters, digits and '-' (up to 63)",
  authKey: "TS_AUTHKEY is required for the first start in tailscale mode (see infra/compose/.env.example)",
  bindAddrWildcard: (value: string) =>
    `THEONE_BIND_ADDR=${value} would publish the sandbox on every host interface; use the host's tailscale IPv4`,
  bindAddr: (value: string) => `THEONE_BIND_ADDR=${value} is not an IPv4 address of this host; use the host's tailscale IPv4`,
  version: "Use a version like latest or 2.1.0",
} as const;

const WILDCARDS = ["0.0.0.0", "::", "[::]", "*"];

function validPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

export function validateFixtureChoices(choices: SetupChoices): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: keyof SetupChoices, message: string) => issues.push({ field, message });
  if (!PROJECT.test(choices.project)) add("project", MESSAGES.project);
  if (!validPort(choices.controllerPort)) add("controllerPort", MESSAGES.port);
  if (!validPort(choices.vncPort)) add("vncPort", MESSAGES.port);
  else if (choices.vncPort === choices.controllerPort) add("vncPort", MESSAGES.portsClash);
  if (choices.mode === "tailscale") {
    if (!choices.tailnetDomain) add("tailnetDomain", MESSAGES.tailnetDomainRequired);
    else if (!DOMAIN.test(choices.tailnetDomain)) add("tailnetDomain", MESSAGES.tailnetDomain);
    if (!HOSTNAME.test(choices.hostname)) add("hostname", MESSAGES.hostname);
    if (!choices.tsAuthKey) add("tsAuthKey", MESSAGES.authKey);
  }
  if (choices.mode === "host-tailscale") {
    const value = choices.bindAddr;
    if (WILDCARDS.includes(value)) add("bindAddr", MESSAGES.bindAddrWildcard(value));
    else if (!IPV4.test(value) || value.startsWith("0.")) add("bindAddr", MESSAGES.bindAddr(value));
  }
  if (!VERSION.test(choices.claudeCodeVersion)) add("claudeCodeVersion", MESSAGES.version);
  if (choices.components.includes("flutter") && !VERSION.test(choices.flutterVersion)) add("flutterVersion", MESSAGES.version);
  return issues;
}
