import { routePatterns } from "@tesseract/protocol";
import { sampleHealth } from "@tesseract/protocol/fixtures";
import { currentScenario } from "../scenario";
import { defineHttpFixtures, reply } from "../types";
import { isGtkParity } from "../shell/parity";
import { overviewStatus } from "./data";
import { parityStatus } from "./gtk-parity";

export const SCENARIOS = {
  noTools: "overview-no-tools",
  collecting: "overview-collecting",
  offline: "overview-offline",
  unauthorized: "overview-unauthorized",
  unconfigured: "overview-unconfigured",
} as const;

const rest = routePatterns.rest;

function failure() {
  const scenario = currentScenario();
  if (scenario === SCENARIOS.offline) return reply(503, { error: { code: "unavailable", message: "Controller is restarting" } });
  if (scenario === SCENARIOS.unauthorized) return reply(401, { error: { code: "unauthorized", message: "Invalid token" } });
  return null;
}

export default defineHttpFixtures([
  { method: "GET", path: rest.health, respond: () => failure() ?? sampleHealth },
  {
    method: "GET",
    path: rest.status,
    respond: () => failure() ?? (isGtkParity() ? parityStatus() : null) ?? overviewStatus(Date.now(), currentScenario() === SCENARIOS.noTools ? [] : undefined),
  },
]);
