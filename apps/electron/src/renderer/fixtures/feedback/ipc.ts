import type { DiscoveryResult } from "../../../shared/contracts/connection";
import { CONFIG_FILE_PATH } from "./data";
import { defineIpcFixtures, type IpcFixtureMethods } from "../types";
import { FEEDBACK_ERRORS, SCENARIOS, feedbackScenario } from "./scenarios";

const pending = () => new Promise<DiscoveryResult>(() => undefined);

const unconfiguredConnection: IpcFixtureMethods["connection"] = {
  load: () => ({ config: null, configFile: CONFIG_FILE_PATH }),
  discover: () =>
    feedbackScenario() === SCENARIOS.discovering ? pending() : { ok: false, error: FEEDBACK_ERRORS.discoveryFailed },
};

export default defineIpcFixtures({
  get connection() {
    const scenario = feedbackScenario();
    return scenario === SCENARIOS.unconfigured || scenario === SCENARIOS.discovering ? unconfiguredConnection : undefined;
  },
});
