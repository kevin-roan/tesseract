import type { GitFileStatus, ProcessInfo } from "@tesseract/protocol";
import { sampleProcess } from "@tesseract/protocol/fixtures";
import { REFERENCE_IDS } from "./data";

export const GTK_PARITY = "gtk-parity";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ids = REFERENCE_IDS;

export const PARITY_SCRIPTS: Readonly<Record<string, string[]>> = {
  [ids.tesseract]: ["mobile", "controller", "desktop", "electron", "lint", "typecheck", "test", "format", "build", "e2e"],
};

interface ParityRun {
  name: string;
  command: string;
  endedAgo: number;
  ranFor: number;
  state?: ProcessInfo["state"];
  exitCode?: number | null;
  port?: number | null;
  display?: boolean;
}

const EXPO_ANDROID = "expo-android (Android emulator)";
const PNPM_ANDROID = "pnpm exec expo run:android --variant debug --port 8081";
const BUN_ANDROID = "bunx expo run:android --variant debug --port 8081";

const PROCESS_RUNS: Readonly<Record<string, readonly ParityRun[]>> = {
  [ids.streaxfit]: [
    { name: EXPO_ANDROID, command: PNPM_ANDROID, endedAgo: 5 * HOUR, ranFor: SECOND, exitCode: 1, port: 8081 },
    { name: EXPO_ANDROID, command: PNPM_ANDROID, endedAgo: 5 * HOUR + 4 * MINUTE, ranFor: SECOND, exitCode: 1, port: 8081 },
    { name: "expo-device (Expo on the phone)", command: "pnpm exec expo start --port 8081 --lan", endedAgo: 5 * HOUR + 20 * MINUTE, ranFor: 2 * SECOND, state: "stopped", exitCode: null, port: 8081 },
    { name: EXPO_ANDROID, command: PNPM_ANDROID, endedAgo: 6 * HOUR, ranFor: SECOND, exitCode: 1, port: 8081 },
    { name: "android:assembleRelease", command: "cd apps/mobile/android && EXPO_PUBLIC_ENV=production ./gradlew assembleRelease", endedAgo: 6 * HOUR + 10 * MINUTE, ranFor: 14 * MINUTE + 58 * SECOND, exitCode: 0 },
    { name: "lint", command: "pnpm run lint", endedAgo: 2 * DAY, ranFor: 3 * SECOND, exitCode: 0 },
  ],
  [ids.tesseract]: [
    { name: EXPO_ANDROID, command: BUN_ANDROID, endedAgo: 5 * HOUR, ranFor: 0, exitCode: 1, port: 8081 },
    { name: EXPO_ANDROID, command: BUN_ANDROID, endedAgo: 10 * HOUR, ranFor: SECOND, exitCode: 1, port: 8081 },
    { name: "android:assembleRelease", command: "cd apps/mobile/android && APP_VARIANT=production ./gradlew assembleRelease", endedAgo: 25 * HOUR, ranFor: 29 * MINUTE + 23 * SECOND, exitCode: 0 },
    { name: "android:assembleRelease", command: "APP_VARIANT=production NODE_ENV=production ./gradlew assembleRelease", endedAgo: 26 * HOUR, ranFor: 0, exitCode: 127 },
    { name: "lint", command: "bun run lint", endedAgo: 5 * DAY, ranFor: 0, exitCode: 127, display: true },
    { name: "lint", command: "bun run lint", endedAgo: 5 * DAY + HOUR, ranFor: 0, exitCode: 127 },
    { name: "lint", command: "bun run lint", endedAgo: 5 * DAY + 2 * HOUR, ranFor: 0, exitCode: 127 },
    { name: "mobile", command: "bun run mobile", endedAgo: 6 * DAY, ranFor: 0, exitCode: 127, display: true },
  ],
};

const RUNNING: ParityRun = { name: EXPO_ANDROID, command: PNPM_ANDROID, endedAgo: 0, ranFor: 13 * MINUTE, state: "running", port: 8081 };

const iso = (time: number) => new Date(time).toISOString();

function toProcess(projectId: string, run: ParityRun, index: number, now: number): ProcessInfo {
  const running = run.state === "running";
  const ended = now - run.endedAgo;
  return {
    ...sampleProcess,
    id: `prc_parity_${projectId}_${index}`,
    projectId,
    name: run.name,
    command: run.command,
    cwd: `/workspace/projects/${projectId}`,
    pid: running ? 86081 : null,
    port: run.port ?? null,
    display: run.display ?? false,
    state: run.state ?? "exited",
    exitCode: running ? null : (run.exitCode ?? null),
    startedAt: iso(ended - run.ranFor),
    endedAt: running ? null : iso(ended),
  };
}

export function parityProcesses(now = Date.now()): ProcessInfo[] {
  const ended = Object.entries(PROCESS_RUNS).flatMap(([projectId, runs]) => runs.map((run, index) => toProcess(projectId, run, index, now)));
  return [toProcess(ids.streaxfit, RUNNING, PROCESS_RUNS[ids.streaxfit]?.length ?? 0, now), ...ended];
}

const CHANGED_FILES: Readonly<Record<string, number>> = {
  [ids.streaxfit]: 114,
  [ids.tesseract]: 92,
  [ids.hybrid]: 12,
};

export function parityGitFiles(projectId: string): GitFileStatus[] {
  const count = CHANGED_FILES[projectId] ?? 0;
  return Array.from({ length: count }, (_, index) => ({ path: `src/file-${String(index).padStart(3, "0")}.ts`, index: " ", worktree: "M" }));
}
