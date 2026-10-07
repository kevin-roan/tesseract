import type { BuildJob, ProcessInfo, Project } from "@theone/protocol";
import { sampleBuild, sampleProcess, sampleProject } from "@theone/protocol/fixtures";

export const SCENARIOS = {
  reference: "Project ids of the reference screenshots (nimble-lotus, theone-mobile, brave-hare)",
  empty: "No projects in the sandbox",
  busy: "A build running on hybrid-pos",
  "gtk-parity": "Reference ids plus the processes, scripts, git counts, run targets and sync data of the GTK reference PNGs",
} as const;

export type ProjectsScenario = keyof typeof SCENARIOS;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number, now = Date.now()) => new Date(now - ms).toISOString();
const OLD_COMMIT_DATE = "2026-09-21T09:30:00.000Z";

export interface ProjectIds {
  streaxfit: string;
  monolith: string;
  hybrid: string;
  sante: string;
}

export const BASE_IDS: ProjectIds = { streaxfit: "streaxfit", monolith: "monolith", hybrid: "hybrid-pos", sante: "sante-production" };
export const REFERENCE_IDS: ProjectIds = { streaxfit: "nimble-lotus", monolith: "theone-mobile", hybrid: "brave-hare", sante: "sante-production" };

export const CLONE_PROCESS_ID = "prc_clonefixture1";

const project = (overrides: Partial<Project> & Pick<Project, "id" | "name">): Project => ({
  ...sampleProject,
  path: `/workspace/projects/${overrides.id}`,
  scripts: [],
  buildTargets: [],
  confidential: false,
  claudeAccountId: null,
  ...overrides,
});

export function fixtureProjectList(ids: ProjectIds, now = Date.now()): Project[] {
  return [
    project({
      id: ids.streaxfit,
      name: "streaxfit",
      framework: "node",
      packageManager: "pnpm",
      confidential: true,
      buildTargets: ["web", "script"],
      git: {
        branch: "main",
        dirty: true,
        ahead: 0,
        behind: 0,
        lastCommit: { sha: "9c1e4b2", subject: "feat: logins of staff who left are hidden from the admin list", date: ago(5 * DAY + HOUR, now) },
      },
    }),
    project({
      id: ids.monolith,
      name: "monolith",
      framework: "node",
      packageManager: "bun",
      scripts: ["mobile", "lint", "typecheck", "test"],
      git: { branch: "main", dirty: true, ahead: 0, behind: 0, lastCommit: { sha: "700e0b4", subject: "feat; more features", date: ago(5 * HOUR + 10 * MINUTE, now) } },
    }),
    project({
      id: ids.hybrid,
      name: "hybrid-pos",
      framework: "electron",
      packageManager: "bun",
      buildTargets: ["electron-linux", "electron-windows", "script"],
      git: {
        branch: "merge/multi-company-into-production",
        dirty: true,
        ahead: 0,
        behind: 0,
        lastCommit: { sha: "41ad7e0", subject: "feat; sales return print", date: ago(DAY + 2 * HOUR, now) },
      },
    }),
    project({
      id: ids.sante,
      name: "sante-production",
      framework: "expo",
      packageManager: "bun",
      buildTargets: ["android-apk"],
      git: { branch: "prod/storefront-fixes", dirty: true, ahead: 0, behind: 0, lastCommit: { sha: "e1f20aa", subject: "chore; eas updates", date: OLD_COMMIT_DATE } },
    }),
  ];
}

const process = (overrides: Partial<ProcessInfo> & Pick<ProcessInfo, "id" | "projectId" | "name">): ProcessInfo => ({
  ...sampleProcess,
  cwd: `/workspace/projects/${overrides.projectId}`,
  display: false,
  port: null,
  ...overrides,
});

export function fixtureProcesses(ids: ProjectIds, now = Date.now()): ProcessInfo[] {
  const ended = (hours: number) => ({ startedAt: ago(hours * HOUR + 1000, now), endedAt: ago(hours * HOUR, now) });
  return [
    process({ id: "prc_streaxfitdev1", projectId: ids.streaxfit, name: "dev", command: "pnpm run dev", port: 8081, pid: 86081, state: "running", startedAt: ago(13 * MINUTE, now), endedAt: null }),
    process({ id: "prc_monoandroid01", projectId: ids.monolith, name: "expo-android (Android emulator)", command: "bunx expo run:android --variant debug", port: 8081, state: "failed", exitCode: 1, ...ended(5) }),
    process({ id: "prc_monoandroid02", projectId: ids.monolith, name: "expo-android (Android emulator)", command: "bunx expo run:android --variant debug", port: 8081, state: "failed", exitCode: 1, ...ended(10) }),
    process({ id: "prc_monoassemble1", projectId: ids.monolith, name: "android:assembleRelease", command: "cd apps/mobile/android && APP_VARIANT=production ./gradlew assembleRelease", state: "exited", exitCode: 0, ...ended(26) }),
    process({ id: "prc_monolint00001", projectId: ids.monolith, name: "lint", command: "bun run lint", display: true, state: "failed", exitCode: 127, ...ended(5 * 24) }),
  ];
}

export function fixtureBuilds(ids: ProjectIds, busy: boolean, now = Date.now()): BuildJob[] {
  if (!busy) return [];
  return [{ ...sampleBuild, id: "bld_hybridlinux01", projectId: ids.hybrid, target: "electron-linux", state: "running", stage: "compile", progress: 0.4, createdAt: ago(2 * MINUTE, now), startedAt: ago(2 * MINUTE, now), endedAt: null, artifacts: [] }];
}

export function cloneLogFrames(): unknown[] {
  const lines = ["Cloning into '/workspace/projects/demo'...", "remote: Enumerating objects: 1240, done.", "Receiving objects: 100% (1240/1240), done.", "Resolving deltas: 100% (610/610), done."];
  return [
    ...lines.map((text, index) => ({ type: "log", line: { seq: index + 1, ts: new Date().toISOString(), stream: "stderr", text } })),
    { type: "exit", code: 0 },
  ];
}
