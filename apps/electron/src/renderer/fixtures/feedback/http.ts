import { routePatterns } from "@tesseract/protocol";
import { sampleHealth } from "@tesseract/protocol/fixtures";
import { defineHttpFixtures, reply, type HttpFixtureRoute } from "../types";
import { FEEDBACK_ERRORS, FEEDBACK_PROTOCOL_VERSION, NEVER_MATCHES, SCENARIOS, feedbackScenario } from "./scenarios";

export { SCENARIOS } from "./scenarios";

function healthResponse(): unknown {
  switch (feedbackScenario()) {
    case SCENARIOS.offline:
      return reply(503, FEEDBACK_ERRORS.offline);
    case SCENARIOS.unauthorized:
      return reply(401, FEEDBACK_ERRORS.unauthorized);
    case SCENARIOS.incompatible:
      return { ...sampleHealth, protocolVersion: FEEDBACK_PROTOCOL_VERSION };
    default:
      return sampleHealth;
  }
}

const health: HttpFixtureRoute = {
  method: "GET",
  get path() {
    return feedbackScenario() ? routePatterns.rest.health : NEVER_MATCHES;
  },
  respond: healthResponse,
};

export default defineHttpFixtures([health]);
