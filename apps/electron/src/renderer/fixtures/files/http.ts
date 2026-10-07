import { routePatterns, type Artifact, type BuildOutput, type TaildropTargets } from "@theone/protocol";
import { GTK_PARITY } from "../projects/parity";
import { currentScenario } from "../scenario";
import { defineHttpFixtures, FixtureReply, reply, type HttpFixtureRequest } from "../types";

export const SCENARIOS = {
  empty: "files-empty",
  noBuilds: "files-no-builds",
  error: "files-error",
  buildsError: "files-builds-error",
  loading: "files-loading",
  taildrop: "files-taildrop",
  gtkParity: GTK_PARITY,
} as const;

const GTK_PARITY_IDS: Readonly<Record<string, string>> = { monolith: "theone-mobile", "hybrid-pos": "brave-hare" };

const rest = routePatterns.rest;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const FILE_TEXT = "Monolith fixture file\n";
const FILE_SHA256 = "2aaeddbad27a79c2d8a1a4db43cf4fbed3d0aa0df732c9344df8f947330f0186";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function artifacts(): Artifact[] {
  return [
    {
      id: "art_fixture_shift_report",
      projectId: "hybrid-pos",
      buildId: null,
      fileName: "SHIFT_MANAGER_SESSION_REPORT_PRINT.md",
      path: "/workspace/artifacts/SHIFT_MANAGER_SESSION_REPORT_PRINT.md",
      sizeBytes: 10_650,
      sha256: FILE_SHA256,
      platform: "file",
      source: "agent",
      agentRunId: null,
      note: "Shift manager session report: print layout, totals per tender, cash drawer reconciliation and voids",
      createdAt: ago(47 * MINUTE_MS),
    },
    {
      id: "art_fixture_best_html",
      projectId: "best-html",
      buildId: null,
      fileName: "index.html",
      path: "/workspace/artifacts/index.html",
      sizeBytes: 3_584,
      sha256: FILE_SHA256,
      platform: "file",
      source: "agent",
      agentRunId: null,
      note: "Basic HTML site (best-html): index page, open it in a browser to preview the layout",
      createdAt: ago(6 * DAY_MS + 3 * 3_600_000),
    },
  ];
}

function outputs(): BuildOutput[] {
  return [
    {
      projectId: "monolith",
      path: "apps/mobile/android/app/build/outputs/apk/release/app-release.apk",
      fileName: "app-release.apk",
      sizeBytes: 103_076_250,
      platform: "android",
      modifiedAt: ago(DAY_MS + 2 * 3_600_000),
    },
    {
      projectId: "monolith",
      path: "apps/mobile/android/app/build/outputs/native-debug-symbols/release/native-debug-symbols.zip",
      fileName: "native-debug-symbols.zip",
      sizeBytes: 13_946_061,
      platform: "file",
      modifiedAt: ago(DAY_MS + 3 * 3_600_000),
    },
    {
      projectId: "hybrid-pos",
      path: "release/build/KenzErp POS Setup 1.1.111.exe",
      fileName: "KenzErp POS Setup 1.1.111.exe",
      sizeBytes: 98_461_696,
      platform: "windows",
      modifiedAt: ago(DAY_MS + 5 * 3_600_000),
    },
  ];
}

const targets: TaildropTargets = {
  available: true,
  targets: [
    { id: "nTS1", hostName: "pixel-8", dnsName: "pixel-8.tail.ts.net.", os: "android", online: true },
    { id: "nTS2", hostName: "MacBook-Air", dnsName: "macbook-air.tail.ts.net.", os: "macOS", online: true },
    { id: "nTS3", hostName: "old-laptop", dnsName: null, os: "linux", online: false },
  ],
};

const failure = () => reply(503, { error: { code: "unavailable", message: "The controller is restarting." } });
const fileBody = () => new FixtureReply(200, FILE_TEXT, "application/octet-stream");
const pending = () => new Promise<never>(() => undefined);

function byProject<T extends { projectId: string }>(items: T[], { query }: HttpFixtureRequest): T[] {
  const projectId = query.get("projectId");
  const scoped = currentScenario() === SCENARIOS.gtkParity ? items.map((item) => ({ ...item, projectId: GTK_PARITY_IDS[item.projectId] ?? item.projectId })) : items;
  return projectId ? scoped.filter((item) => item.projectId === projectId) : scoped;
}

function listArtifacts(request: HttpFixtureRequest) {
  const scenario = currentScenario();
  if (scenario === SCENARIOS.loading) return pending();
  if (scenario === SCENARIOS.error) return failure();
  if (scenario === SCENARIOS.empty) return [];
  return byProject(artifacts(), request);
}

function listOutputs(request: HttpFixtureRequest) {
  const scenario = currentScenario();
  if (scenario === SCENARIOS.loading) return pending();
  if (scenario === SCENARIOS.buildsError) return failure();
  if (scenario === SCENARIOS.empty || scenario === SCENARIOS.noBuilds) return [];
  return byProject(outputs(), request);
}

function findArtifact({ params }: HttpFixtureRequest) {
  return artifacts().find((artifact) => artifact.id === params[0]) ?? reply(404, { error: { code: "not_found", message: "Artifact not found" } });
}

export default defineHttpFixtures([
  { method: "GET", path: rest.artifacts, respond: listArtifacts },
  { method: "GET", path: rest.buildOutputs, respond: listOutputs },
  { method: "DELETE", path: rest.artifact, respond: findArtifact },
  { method: "GET", path: rest.artifactDownload, respond: fileBody },
  { method: "GET", path: rest.buildOutputDownload, respond: fileBody },
  {
    method: "GET",
    path: rest.taildropTargets,
    respond: () => (currentScenario() === SCENARIOS.taildrop ? targets : { available: false, targets: [] }),
  },
  { method: "POST", path: rest.artifactTaildrop, respond: findArtifact },
]);
