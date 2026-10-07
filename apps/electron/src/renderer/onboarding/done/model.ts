import type { OnboardingState, StepStatus } from "../../../shared/contracts/onboarding";
import type { OnboardingStepId } from "../../../shared/routes";
import { DONE_LABELS } from "./labels";

export type SummaryStatus = "done" | "warning" | "error" | "skipped" | "pending";
export type SummaryId = keyof typeof DONE_LABELS.rows;

export interface SummaryItem {
  id: SummaryId;
  title: string;
  detail: string;
  status: SummaryStatus;
}

export function summaryStatus(status: StepStatus | undefined): SummaryStatus {
  switch (status) {
    case "done":
    case "warning":
    case "error":
    case "skipped":
      return status;
    default:
      return "pending";
  }
}

function statusOf(state: OnboardingState, step: OnboardingStepId): SummaryStatus {
  return summaryStatus(state.statuses[step]);
}

function dockerItem(state: OnboardingState): SummaryItem {
  const report = state.docker;
  const version = report?.server?.version ?? report?.cli?.version ?? "";
  const status = statusOf(state, "docker");
  const fallback = status === "done" ? DONE_LABELS.ready : DONE_LABELS.notChecked;
  const detail = report ? `${DONE_LABELS.dockerKinds[report.kind]} ${version}`.trim() : fallback;
  return { id: "docker", title: DONE_LABELS.rows.docker, detail, status };
}

function claudeItem(state: OnboardingState): SummaryItem {
  const accounts = state.claude ?? [];
  const primary = accounts.find((account) => account.primary) ?? accounts[0] ?? null;
  const signedIn = primary?.login === "signed-in";
  const detail = signedIn
    ? primary.email
      ? DONE_LABELS.signedInAs(primary.email)
      : DONE_LABELS.signedIn
    : DONE_LABELS.notSignedIn;
  const recorded = statusOf(state, "claude");
  const status: SummaryStatus = recorded === "pending" ? (signedIn ? "done" : "warning") : recorded;
  return { id: "claude", title: DONE_LABELS.rows.claude, detail, status };
}

function sandboxItem(state: OnboardingState): SummaryItem {
  const url = state.pair?.url ?? (state.build.kind === "done" ? state.build.apiUrl : null);
  const name = state.pair?.name ?? state.choices.hostname ?? state.choices.project;
  const detail = url ? [name, url].filter(Boolean).join(" · ") : DONE_LABELS.notBuilt;
  return {
    id: "sandbox",
    title: DONE_LABELS.rows.sandbox,
    detail,
    status: statusOf(state, "build"),
  };
}

function optionalStatus(recorded: SummaryStatus, ready: boolean): SummaryStatus {
  if (!ready) return "skipped";
  return recorded === "pending" ? "done" : recorded;
}

function androidItem(state: OnboardingState): SummaryItem {
  const done = state.android.kind === "done" && state.statuses.android !== "skipped";
  const status = optionalStatus(statusOf(state, "android"), done);
  const detail = state.android.kind === "done" && done ? state.android.avd : DONE_LABELS.skipped;
  return { id: "android", title: DONE_LABELS.rows.android, detail, status };
}

function pairItem(state: OnboardingState): SummaryItem {
  const ready = state.pair !== null && state.statuses.pair !== "skipped";
  return {
    id: "pair",
    title: DONE_LABELS.rows.pair,
    detail: ready ? DONE_LABELS.pairingReady : DONE_LABELS.skipped,
    status: optionalStatus(statusOf(state, "pair"), ready),
  };
}

export function summarize(state: OnboardingState | null | undefined): SummaryItem[] {
  if (!state) {
    return (Object.keys(DONE_LABELS.rows) as SummaryId[]).map((id) => ({
      id,
      title: DONE_LABELS.rows[id],
      detail: DONE_LABELS.notChecked,
      status: "pending",
    }));
  }
  return [dockerItem(state), claudeItem(state), sandboxItem(state), androidItem(state), pairItem(state)];
}
