import { currentScenario } from "../scenario";

export const SCENARIOS = {
  offline: "feedback-offline",
  unauthorized: "feedback-unauthorized",
  incompatible: "feedback-incompatible",
  unconfigured: "feedback-unconfigured",
  discovering: "feedback-discovering",
} as const;

export type FeedbackScenario = (typeof SCENARIOS)[keyof typeof SCENARIOS];

export const NEVER_MATCHES = /(?!)/;

export function feedbackScenario(): FeedbackScenario | null {
  const scenario = currentScenario();
  return (Object.values(SCENARIOS) as string[]).includes(scenario ?? "") ? (scenario as FeedbackScenario) : null;
}

export const FEEDBACK_ERRORS = {
  offline: { error: { code: "unavailable", message: "connect ECONNREFUSED 127.0.0.1:7700" } },
  unauthorized: { error: { code: "unauthorized", message: "Invalid token" } },
  discoveryFailed: "No running sandbox container was found",
} as const;

export const FEEDBACK_PROTOCOL_VERSION = 99;
