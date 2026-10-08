import type { StartAppRun } from "@tesseract/protocol";
import { routePatterns } from "@tesseract/protocol";
import { sampleSandboxAndroidStatus } from "@tesseract/protocol/fixtures";
import { GTK_PARITY } from "../projects/parity";
import { currentScenario, isScenario } from "../scenario";
import { defineHttpFixtures, reply } from "../types";
import { FIXTURE_RUN_TARGETS, PARITY_LIVE_RUN_PROJECT, PARITY_RUN_TARGETS, hostAndroid, liveAndroidRun } from "./data";

export const SCENARIOS = {
  running: "emulator-running",
  outdated: "emulator-outdated",
} as const;

const rest = routePatterns.rest;

export default defineHttpFixtures([
  {
    method: "GET",
    path: rest.projectRunTargets,
    respond: ({ params }) => {
      if (currentScenario() === SCENARIOS.outdated) return reply(404, { error: { code: "not_found", message: "Not found" } });
      const projectId = params[0] ?? "";
      const targets = (isScenario(GTK_PARITY) ? PARITY_RUN_TARGETS : FIXTURE_RUN_TARGETS)[projectId] ?? [];
      const ready = hostAndroid.emulator.state === "running" && hostAndroid.link.connected;
      return targets.map((target) => (target.viewer === "android" && ready ? { ...target, available: true, reason: null } : target));
    },
  },
  {
    method: "GET",
    path: rest.appRuns,
    respond: ({ query }) => {
      const projectId = query.get("projectId");
      if (isScenario(GTK_PARITY)) return projectId === PARITY_LIVE_RUN_PROJECT ? [liveAndroidRun(projectId)] : [];
      return currentScenario() === SCENARIOS.running && projectId ? [liveAndroidRun(projectId)] : [];
    },
  },
  {
    method: "POST",
    path: rest.projectAppRuns,
    respond: ({ params, body }) => ({ ...liveAndroidRun(params[0] ?? ""), state: "starting", target: (body as StartAppRun).target }),
  },
  {
    method: "GET",
    path: rest.android,
    respond: () => ({ ...sampleSandboxAndroidStatus, emulator: hostAndroid.emulator.serial ? hostAndroid.emulator : sampleSandboxAndroidStatus.emulator }),
  },
]);
