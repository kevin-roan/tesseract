import type { DockerCheck, DockerPhase, DockerReport } from "../../../shared/contracts/docker";

const GIB = 1024 ** 3;

export const DOCKER_SCENARIOS = {
  ready: "docker-ready",
  warnings: "docker-warnings",
  missing: "docker-missing",
  stopped: "docker-stopped",
  permission: "docker-permission",
  podman: "docker-podman",
  installing: "docker-installing",
  starting: "docker-starting",
  relogin: "docker-relogin",
} as const;

const SERVER = {
  version: "29.8.1",
  os: "linux",
  arch: "x86_64",
  ncpu: 16,
  memBytes: 31 * GIB,
  rootDir: "/var/lib/docker",
  rootless: false,
};

const LINUX = { inDockerGroup: true, socketGroup: "docker", systemd: true, serviceActive: true };

const ok = (id: string, title: string, detail: string): DockerCheck => ({ id, status: "ok", title, detail });

const READY_CHECKS: DockerCheck[] = [
  ok("cli", "Docker", "Docker Engine 29.8.1"),
  ok("daemon", "Engine", "Running · linux/x86_64 · default"),
  ok("compose", "Docker Compose", "2.40.3"),
  ok("buildx", "BuildKit", "buildx 0.29.1"),
  ok("engine_version", "Engine version", "29.8.1"),
  ok("resources", "Resources", "16 CPUs · 31 GB for containers"),
  ok("group", "docker group", "dev is in the docker group"),
];

export const READY_REPORT: DockerReport = {
  cli: { path: "/usr/bin/docker", version: "29.8.1" },
  daemon: "reachable",
  daemonError: null,
  kind: "engine",
  context: "default",
  server: SERVER,
  compose: "2.40.3",
  buildx: "0.29.1",
  linux: LINUX,
  checks: READY_CHECKS,
};

function withChecks(report: DockerReport, replace: Record<string, DockerCheck | null>): DockerReport {
  const checks = report.checks
    .map((check) => (check.id in replace ? replace[check.id] : check))
    .filter((check): check is DockerCheck => check !== null);
  return { ...report, checks };
}

const WARNINGS_REPORT = withChecks(
  { ...READY_REPORT, server: { ...SERVER, memBytes: 6 * GIB } },
  {
    resources: { id: "resources", status: "warning", title: "Resources", detail: "The sandbox is limited to 6 GB (it asks for 8 GB)" },
    engine_version: { id: "engine_version", status: "warning", title: "Engine version", detail: "Docker 23.0.6 is older than 24; update if the build fails" },
  },
);

const MISSING_REPORT: DockerReport = {
  cli: null,
  daemon: "unknown",
  daemonError: null,
  kind: "unknown",
  context: null,
  server: null,
  compose: null,
  buildx: null,
  linux: { inDockerGroup: false, socketGroup: null, systemd: true, serviceActive: null },
  checks: [
    { id: "cli", status: "error", title: "Docker", detail: "Docker isn't installed", action: "install" },
    { id: "daemon", status: "pending", title: "Engine", detail: "Checking the engine…" },
    { id: "compose", status: "error", title: "Docker Compose", detail: "Docker Compose v2 is missing", action: "compose-docs" },
    { id: "buildx", status: "error", title: "BuildKit", detail: "docker buildx is missing; the image needs BuildKit", action: "buildx-docs" },
  ],
};

const STOPPED_REPORT: DockerReport = {
  ...READY_REPORT,
  daemon: "stopped",
  server: null,
  checks: [
    ok("cli", "Docker", "Docker Engine 29.8.1"),
    { id: "daemon", status: "error", title: "Engine", detail: "The Docker engine isn't running", action: "start" },
    ok("compose", "Docker Compose", "2.40.3"),
    ok("buildx", "BuildKit", "buildx 0.29.1"),
  ],
};

const PERMISSION_REPORT: DockerReport = {
  ...STOPPED_REPORT,
  daemon: "permission",
  linux: { ...LINUX, inDockerGroup: false },
  checks: [
    ok("cli", "Docker", "Docker Engine 29.8.1"),
    { id: "daemon", status: "error", title: "Engine", detail: "You don't have access to the Docker engine", action: "fix-permission" },
    ok("compose", "Docker Compose", "2.40.3"),
    ok("buildx", "BuildKit", "buildx 0.29.1"),
    { id: "group", status: "warning", title: "docker group", detail: "dev isn't in the docker group" },
  ],
};

const PODMAN_REPORT: DockerReport = {
  ...READY_REPORT,
  kind: "podman",
  cli: { path: "/usr/bin/docker", version: "5.6.1" },
  checks: [
    ok("cli", "Docker", "Podman 5.6.1"),
    ok("daemon", "Engine", "Running · linux/amd64"),
    {
      id: "podman",
      status: "error",
      title: "Podman",
      detail:
        "Podman isn't supported yet: the sandbox needs Docker Compose 2.24+ features and BuildKit cache mounts. Install Docker Engine or Docker Desktop.",
    },
  ],
};

export const SCENARIO_REPORTS: Record<string, DockerReport> = {
  [DOCKER_SCENARIOS.warnings]: WARNINGS_REPORT,
  [DOCKER_SCENARIOS.missing]: MISSING_REPORT,
  [DOCKER_SCENARIOS.installing]: MISSING_REPORT,
  [DOCKER_SCENARIOS.stopped]: STOPPED_REPORT,
  [DOCKER_SCENARIOS.starting]: STOPPED_REPORT,
  [DOCKER_SCENARIOS.permission]: PERMISSION_REPORT,
  [DOCKER_SCENARIOS.relogin]: PERMISSION_REPORT,
  [DOCKER_SCENARIOS.podman]: PODMAN_REPORT,
};

const START_OFFSET_MS = 7000;

export function scenarioPhase(scenario: string | null, report: DockerReport): DockerPhase {
  switch (scenario) {
    case DOCKER_SCENARIOS.installing:
      return { kind: "installing", stage: "downloading", received: 412 * 1024 ** 2, total: 1.9 * GIB };
    case DOCKER_SCENARIOS.starting:
      return { kind: "starting", since: Date.now() - START_OFFSET_MS };
    case DOCKER_SCENARIOS.relogin:
      return { kind: "needs-relogin" };
    default: {
      const blocking = report.checks.find((check) => check.status === "error");
      return blocking ? { kind: "blocked", reason: blocking.detail } : { kind: "ready" };
    }
  }
}

export const SCENARIO_LOGS: Record<string, string[]> = {
  [DOCKER_SCENARIOS.installing]: [
    "Downloading https://get.docker.com",
    "sha256 3b1f0c6e4f2d9a7c5e8b1d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c  get-docker.sh",
    "$ pkexec sh /home/dev/.config/Monolith/downloads/get-docker.sh",
    "# Executing docker install script, commit: 4c94a56999e10efcf48c5b8e3f6afea464f9108e",
  ],
  [DOCKER_SCENARIOS.starting]: ["$ pkexec systemctl start docker.service", "Waiting for the engine (7s)"],
};
