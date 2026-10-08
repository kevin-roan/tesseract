import { IpcError } from "../../../shared/ipc-types";
import { defineIpcFixtures } from "../types";
import { FIXTURE_COMPLETED_AT, ONBOARDING_FINAL_SCENARIOS, claudeAccount, scenarioState } from "./data";
import { currentScenario } from "../scenario";

const PAIR_ERROR = "tesseract-controller pair --json printed no pairing link";

function claudeChecked() {
  const state = scenarioState();
  return { ...state, step: "claude" as const };
}

export default defineIpcFixtures({
  onboarding: {
    claudeCheck: () => claudeChecked(),
    claudeCreateDir: () => {
      const state = claudeChecked();
      if (state.claude?.some((account) => account.primary)) return state;
      return {
        ...state,
        claude: [
          claudeAccount({
            login: "missing",
            email: null,
            organization: null,
            subscriptionType: null,
            expiresAt: null,
          }),
        ],
      };
    },
    pairLoad: () => {
      const scenario = currentScenario();
      if (scenario === ONBOARDING_FINAL_SCENARIOS.pairError) throw new IpcError("unavailable", PAIR_ERROR);
      return { ...scenarioState(), step: "pair" };
    },
    finish: () => ({ ...scenarioState(), completedAt: FIXTURE_COMPLETED_AT }),
  },
});
