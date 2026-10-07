import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { TIMELINE_LABELS } from "./labels";

export type OutcomeState = "succeeded" | "failed" | "cancelled";

export interface OutcomePresentation {
  title: string;
  tone: Tone;
  icon: IconName;
}

const OUTCOMES: Record<OutcomeState, OutcomePresentation> = {
  succeeded: { title: TIMELINE_LABELS.outcome.succeeded, tone: "success", icon: "success" },
  failed: { title: TIMELINE_LABELS.outcome.failed, tone: "danger", icon: "failed" },
  cancelled: { title: TIMELINE_LABELS.outcome.cancelled, tone: "neutral", icon: "failed" },
};

export function outcomeFor(state: string): OutcomePresentation {
  return OUTCOMES[state as OutcomeState] ?? OUTCOMES.cancelled;
}
