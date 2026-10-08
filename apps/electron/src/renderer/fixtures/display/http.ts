import { routePatterns } from "@tesseract/protocol";
import { defineHttpFixtures, FixtureReply, reply } from "../types";
import { DISPLAY_SCENARIOS, FIXTURE_DISPLAY_ERROR, scenarioDisplayStatus, scenarioWindows } from "./data";
import { sceneSvg } from "./scene";
import { currentScenario } from "../scenario";

export const SCENARIOS = DISPLAY_SCENARIOS;

const rest = routePatterns.rest;
const SVG_TYPE = "image/svg+xml";
const BAD_GATEWAY = 502;

const pending = () => new Promise<never>(() => undefined);

export default defineHttpFixtures([
  {
    method: "GET",
    path: rest.display,
    respond: () => {
      const scenario = currentScenario();
      if (scenario === DISPLAY_SCENARIOS.loading) return pending();
      if (scenario === DISPLAY_SCENARIOS.error) return reply(BAD_GATEWAY, { error: { code: "bad_gateway", message: FIXTURE_DISPLAY_ERROR } });
      return scenarioDisplayStatus(scenario);
    },
  },
  { method: "GET", path: rest.displayWindows, respond: () => ({ windows: scenarioWindows() }) },
  { method: "POST", path: rest.displayWindowActivate, respond: () => undefined },
  { method: "POST", path: rest.displayWindowClose, respond: () => undefined },
  { method: "GET", path: rest.displayScreenshot, respond: () => new FixtureReply(200, sceneSvg(), SVG_TYPE) },
]);
