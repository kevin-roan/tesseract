import type { DockerPhase, DockerReport } from "../../../shared/contracts/docker";
import { emitFixtureEvent } from "../registry";
import { currentScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import { DOCKER_SCENARIOS, READY_REPORT, SCENARIO_LOGS, SCENARIO_REPORTS, scenarioPhase } from "./reports";

export const SCENARIOS = DOCKER_SCENARIOS;

const SETTLE_MS = 1500;

let report: DockerReport | null = null;
let phase: DockerPhase | null = null;

function scenarioReport(): DockerReport {
  report ??= SCENARIO_REPORTS[currentScenario() ?? ""] ?? READY_REPORT;
  return report;
}

function currentPhase(): DockerPhase {
  phase ??= scenarioPhase(currentScenario(), scenarioReport());
  return phase;
}

function setPhase(next: DockerPhase): DockerPhase {
  phase = next;
  emitFixtureEvent("docker", "phase", next);
  return next;
}

function settleReady(): void {
  setTimeout(() => {
    report = READY_REPORT;
    emitFixtureEvent("docker", "report", READY_REPORT);
    setPhase({ kind: "ready" });
  }, SETTLE_MS);
}

export default defineIpcFixtures({
  docker: {
    check: () => scenarioReport(),
    phase: () => currentPhase(),
    log: () => SCENARIO_LOGS[currentScenario() ?? ""] ?? [],
    start: () => {
      settleReady();
      return setPhase({ kind: "starting", since: Date.now() });
    },
    install: (request) => {
      if (request.option === "docker-group") return setPhase({ kind: "needs-relogin" });
      if (request.option === "manual" || request.option === "desktop-linux") return currentPhase();
      settleReady();
      return setPhase({ kind: "installing", stage: "installing", received: 0, total: null });
    },
    cancel: () => setPhase(scenarioPhase(null, scenarioReport())),
  },
});
