import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { isOnboardingStepId, ROUTE, type OnboardingStepId } from "../../../shared/routes";
import { ONBOARDING_STEPS } from "../../app/registry/onboarding";
import { ipc } from "../../lib/ipc";
import { ONBOARDING_STATE_KEY } from "./constants";
import { adjacentStep } from "./model";

export interface OnboardingNavigation {
  current: OnboardingStepId | null;
  goTo(step: OnboardingStepId, search?: string): void;
  next(): void;
  back(): void;
  skip(): void;
}

export function useOnboardingNavigation(): OnboardingNavigation {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { step } = useParams();
  const current = step && isOnboardingStepId(step) ? step : null;

  const goTo = useCallback(
    (target: OnboardingStepId, search = "") => {
      navigate(`${ROUTE.onboarding(target)}${search}`);
      ipc.onboarding
        .goto(target)
        .then((state) => client.setQueryData(ONBOARDING_STATE_KEY, state))
        .catch(() => undefined);
    },
    [client, navigate],
  );

  const move = useCallback(
    (delta: number) => {
      const target = current ? adjacentStep(ONBOARDING_STEPS, current, delta) : null;
      if (target) goTo(target);
    },
    [current, goTo],
  );

  const skip = useCallback(() => {
    if (!current) return;
    const target = adjacentStep(ONBOARDING_STEPS, current, 1);
    ipc.onboarding
      .skip(current)
      .then((state) => client.setQueryData(ONBOARDING_STATE_KEY, state))
      .catch(() => undefined);
    if (target) navigate(ROUTE.onboarding(target));
  }, [client, current, navigate]);

  return { current, goTo, next: () => move(1), back: () => move(-1), skip };
}
