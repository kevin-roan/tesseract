import type { SyncChanges, SyncFileChange, SyncRequest } from "@theone/protocol";
import type { FileDiff, HostChange, SnapshotSummary, SyncLinkSummary } from "../../../shared/contracts/syncback";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const sha = (seed: string) => seed.repeat(64).slice(0, 64);

export const FIXTURE_LINKS: SyncLinkSummary[] = [
  { projectId: "sante-production", hostPath: "/mnt/data/dev/Projects/work/sante-production", pushedAt: ago(7 * HOUR_MS), gotAt: null, confidential: false, files: 412 },
  { projectId: "hybrid-pos", hostPath: "/mnt/data/dev/Projects/ejs/racecast-pos", pushedAt: ago(2 * DAY_MS), gotAt: ago(56 * MINUTE_MS), confidential: false, files: 1290 },
  { projectId: "monolith", hostPath: "/home/dev/code/monolith", pushedAt: ago(3 * HOUR_MS), gotAt: ago(2 * HOUR_MS), confidential: false, files: 820 },
];

const change = (path: string, kind: SyncFileChange["kind"], size: number | null, discardable = true): SyncFileChange => ({
  path,
  kind,
  size,
  sha256: kind === "deleted" ? null : sha(String(path.length % 10)),
  discardable,
});

const HYBRID_CHANGES: SyncFileChange[] = [
  change("docs/BACKEND_SALES_RETURN_EDIT.md", "added", 5530),
  change("docs/SHIFT_MANAGER_SESSION_REPORT_PRINT.md", "added", 10650),
  change("package-lock.json", "modified", 550_912),
  change("package.json", "modified", 10_650),
  change("release/app/package.json", "modified", 568),
  change("src/components/modals/globalsettings/index.tsx", "modified", 109_568),
  change("src/main/ipc/printers.ts", "modified", 8_420),
  change("src/main/main.ts", "modified", 14_894),
  change("src/renderer/pages/sales/ReturnEdit.tsx", "added", 9_870),
  change("src/renderer/pages/shift/SessionReport.tsx", "modified", 11_032),
  change("src/renderer/store/cart.ts", "modified", 6_210),
  change("src/legacy/report-print.ts", "deleted", null),
];

const MONOLITH_CHANGES: SyncFileChange[] = [
  change("apps/electron/src/main/index.ts", "modified", 4_120),
  change("docs/electron/conventions.md", "modified", 21_840),
  change("apps/electron/assets/hero.png", "added", 2_400_000, false),
];

const totalBytes = (changes: SyncFileChange[]) => changes.reduce((sum, item) => sum + (item.size ?? 0), 0);

const changes = (projectId: string, list: SyncFileChange[], baselineAt: string | null): SyncChanges => ({
  projectId,
  baselineAt,
  changes: list,
  totalBytes: totalBytes(list),
  host: { name: "workstation", lastSeenAt: ago(MINUTE_MS), online: true, linked: true },
});

export const FIXTURE_CHANGES: Readonly<Record<string, SyncChanges>> = {
  "sante-production": changes("sante-production", [], ago(7 * HOUR_MS)),
  "hybrid-pos": changes("hybrid-pos", HYBRID_CHANGES, ago(2 * DAY_MS)),
  monolith: changes("monolith", MONOLITH_CHANGES, ago(3 * HOUR_MS)),
  streaxfit: changes("streaxfit", [], null),
};

const request = (id: string, kind: SyncRequest["kind"], status: SyncRequest["status"], createdAt: string, extra: Partial<SyncRequest> = {}): SyncRequest => ({
  id,
  projectId: "monolith",
  kind,
  status,
  paths: null,
  force: false,
  source: "desktop",
  claimedBy: status === "pending" ? null : "workstation",
  result: null,
  error: null,
  createdAt,
  updatedAt: createdAt,
  ...extra,
});

export const FIXTURE_REQUESTS: Readonly<Record<string, SyncRequest[]>> = {
  monolith: [
    request("sync_p3nd1ng0a1", "pull", "pending", ago(MINUTE_MS)),
    request("sync_4ppl13d0b2", "get", "applied", ago(2 * HOUR_MS), {
      source: "cli",
      result: { added: 1, modified: 3, deleted: 0, conflicts: [], snapshotId: null, hostPath: "/home/dev/code/monolith", insertions: 42, deletions: 7, gitFiles: 3 },
    }),
    request("sync_4ppl13d0c3", "pull", "applied", ago(3 * HOUR_MS), {
      result: { added: 2, modified: 5, deleted: 1, conflicts: [], snapshotId: "20260923T100500Z", hostPath: "/home/dev/code/monolith" },
    }),
    request("sync_f41l3d00d4", "pull", "failed", ago(5 * HOUR_MS), { source: "mobile", error: "The host folder is not linked on workstation" }),
  ],
};

export const FIXTURE_SNAPSHOTS: Readonly<Record<string, SnapshotSummary[]>> = {
  monolith: [
    { id: "20260923T100500Z", createdAt: ago(3 * HOUR_MS), entries: 8, reverted: false, kind: "pull" },
    { id: "20260922T171200Z", createdAt: ago(DAY_MS + 6 * HOUR_MS), entries: 2, reverted: true, kind: "pull" },
  ],
};

export const FIXTURE_HOST_CHANGES: Readonly<Record<string, HostChange[]>> = {
  "sante-production": [
    { path: "app.json", kind: "modified" },
    { path: "eas.json", kind: "added" },
  ],
};

const DIFF_LINES: FileDiff = {
  kind: "text",
  path: "",
  truncated: false,
  lines: [
    { kind: "hunk", oldLine: null, newLine: null, text: "@@ -1,7 +1,9 @@" },
    { kind: "context", oldLine: 1, newLine: 1, text: "{" },
    { kind: "context", oldLine: 2, newLine: 2, text: '  "name": "racecast-pos",' },
    { kind: "del", oldLine: 3, newLine: null, text: '  "version": "4.12.0",' },
    { kind: "add", oldLine: null, newLine: 3, text: '  "version": "4.13.0",' },
    { kind: "context", oldLine: 4, newLine: 4, text: '  "private": true,' },
    { kind: "add", oldLine: null, newLine: 5, text: '  "workspaces": ["release/app"],' },
    { kind: "add", oldLine: null, newLine: 6, text: '  "packageManager": "bun@1.3.2",' },
    { kind: "context", oldLine: 5, newLine: 7, text: '  "scripts": {' },
    { kind: "context", oldLine: 6, newLine: 8, text: '    "build": "electron-vite build"' },
    { kind: "context", oldLine: 7, newLine: 9, text: "  }" },
  ],
};

export function fixtureDiff(path: string): FileDiff {
  if (path.endsWith(".png")) return { kind: "binary", path, hostSize: null, sandboxSize: 2_400_000 };
  return { ...DIFF_LINES, path };
}

const THEONE_MOBILE_CHANGES: SyncFileChange[] = [
  ...MONOLITH_CHANGES,
  change("apps/electron/src/renderer/pages/projects/ProjectsPage.tsx", "modified", 2_310),
  change("apps/electron/src/renderer/pages/files/FilesPage.tsx", "modified", 3_870),
  change("apps/electron/src/renderer/pages/display/DisplayPage.tsx", "modified", 4_020),
  change("apps/electron/src/renderer/shell/Shell.tsx", "modified", 1_980),
  change("apps/electron/scripts/parity.ts", "added", 6_140),
  change("apps/mobile/app.json", "modified", 3_210),
  change("apps/mobile/package.json", "modified", 4_480),
  change("README.md", "modified", 8_900),
];

export function parityLinks(): SyncLinkSummary[] {
  return [
    { ...FIXTURE_LINKS[0]!, pushedAt: ago(7 * HOUR_MS) },
    { ...FIXTURE_LINKS[1]!, projectId: "brave-hare", pushedAt: ago(2 * DAY_MS), gotAt: ago(56 * MINUTE_MS) },
    { ...FIXTURE_LINKS[2]!, projectId: "theone-mobile", hostPath: "/mnt/data/dev/Projects/work/theone-mobile", pushedAt: ago(3 * HOUR_MS), gotAt: ago(2 * HOUR_MS) },
  ];
}

export function parityChanges(): Readonly<Record<string, SyncChanges>> {
  return {
    "sante-production": changes("sante-production", [], ago(7 * HOUR_MS)),
    "brave-hare": changes("brave-hare", HYBRID_CHANGES, ago(2 * DAY_MS)),
    "theone-mobile": changes("theone-mobile", THEONE_MOBILE_CHANGES, ago(3 * HOUR_MS)),
    "nimble-lotus": changes("nimble-lotus", [], null),
  };
}
