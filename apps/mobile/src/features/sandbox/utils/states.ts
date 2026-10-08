import type { AgentRunState, BuildState, ProcessState, TerminalState } from "@tesseract/protocol";

import type { Tone } from "@/lib/tone";

import type { IssueNotice, PageConnection, ProjectActivity, SandboxIssue, SandboxLink } from "../types";
import { capitalize } from "./format";

const PROCESS_TONES: Record<ProcessState, Tone> = {
  starting: "info",
  running: "success",
  exited: "neutral",
  failed: "danger",
  stopped: "neutral",
  orphaned: "warning",
};

const BUILD_TONES: Record<BuildState, Tone> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "warning",
};

const AGENT_RUN_TONES: Record<AgentRunState, Tone> = {
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "warning",
};

const TERMINAL_TONES: Record<TerminalState, Tone> = {
  running: "success",
  exited: "neutral",
};

const LINK_TONES: Record<SandboxLink, Tone> = {
  idle: "neutral",
  connecting: "warning",
  open: "success",
  closed: "danger",
};

const LINK_LABELS: Record<SandboxLink, string> = {
  idle: "Not connected",
  connecting: "Connecting",
  open: "Online",
  closed: "Offline",
};

const PAGE_TONES: Record<PageConnection, Tone> = {
  loading: "neutral",
  connecting: "warning",
  connected: "success",
  disconnected: "danger",
  exited: "neutral",
};

const PROJECT_ACTIVITY: Record<ProjectActivity, { label: string; tone: Tone }> = {
  building: { label: "Building", tone: "info" },
  agent: { label: "Claude working", tone: "info" },
  running: { label: "Running", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  idle: { label: "Idle", tone: "neutral" },
};

const ISSUE_NOTICES: Record<SandboxIssue, IssueNotice> = {
  unauthorized: {
    title: "Pairing no longer valid",
    message: "The sandbox rejected this device's token, probably because it was rotated. Pair again with a fresh link.",
    actionLabel: "Pair again",
  },
  incompatible: {
    title: "Version mismatch",
    message: "This sandbox speaks a different protocol version than the app. Update the app or the sandbox image so they match.",
    actionLabel: "Pair again",
  },
};

export const processTone = (state: ProcessState): Tone => PROCESS_TONES[state];
export const buildTone = (state: BuildState): Tone => BUILD_TONES[state];
export const agentRunTone = (state: AgentRunState): Tone => AGENT_RUN_TONES[state];
export const terminalTone = (state: TerminalState): Tone => TERMINAL_TONES[state];
export const linkTone = (link: SandboxLink): Tone => LINK_TONES[link];
export const linkLabel = (link: SandboxLink): string => LINK_LABELS[link];
export const issueNotice = (issue: SandboxIssue): IssueNotice => ISSUE_NOTICES[issue];
export const projectActivityLabel = (activity: ProjectActivity): string => PROJECT_ACTIVITY[activity].label;
export const projectActivityTone = (activity: ProjectActivity): Tone => PROJECT_ACTIVITY[activity].tone;
export const pageTone = (state: PageConnection): Tone => PAGE_TONES[state];

export const stateLabel = (state: string): string => capitalize(state);

export const OFFLINE_BADGE: { label: string; tone: Tone } = { label: "Offline", tone: "danger" };
