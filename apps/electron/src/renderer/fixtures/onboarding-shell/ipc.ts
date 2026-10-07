import type { OnboardingState } from "../../../shared/contracts/onboarding";
import { emitFixtureEvent } from "../registry";
import { defineIpcFixtures } from "../types";
import { fixtureOnboardingState, SHELL_SCENARIOS } from "./state";

export const SCENARIOS = SHELL_SCENARIOS;

let state: OnboardingState | null = null;

function current(): OnboardingState {
  state ??= fixtureOnboardingState();
  return state;
}

function update(next: OnboardingState): OnboardingState {
  state = next;
  emitFixtureEvent("onboarding", "state", next);
  return next;
}

export default defineIpcFixtures({
  onboarding: {
    get: () => current(),
    goto: (step) => {
      const previous = current();
      const statuses = { ...previous.statuses };
      if (statuses[previous.step] === "active") statuses[previous.step] = "pending";
      if (statuses[step] === "pending") statuses[step] = "active";
      return update({ ...previous, step, statuses });
    },
    skip: (step) => {
      const previous = current();
      return update({ ...previous, statuses: { ...previous.statuses, [step]: "skipped" } });
    },
    openExternal: () => undefined,
  },
});
