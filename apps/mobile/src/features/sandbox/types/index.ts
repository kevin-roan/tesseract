import type { ConnectionState } from "@theone/client";
import type { BuildTarget, TerminalKind } from "@theone/protocol";
import type { Icon } from "phosphor-react-native";

export type PairedSandbox = {
  id: string;
  name: string;
  baseUrl: string;
  addedAt: string;
};

export type NewSandbox = {
  name: string;
  baseUrl: string;
  token: string;
};

export type SandboxLink = "idle" | ConnectionState;

export type SandboxIssue = "unauthorized" | "incompatible";

export type IssueNotice = {
  title: string;
  message: string;
  actionLabel: string;
};

export type PairingPrefill = {
  url: string;
  name: string;
};

export type PairingField = "url" | "token" | "name";

export type PairingDraft = Record<PairingField, string>;

export type PairingErrors = Partial<Record<PairingField, string>>;

export type PairingStatus = "idle" | "validating" | "error" | "paired";

export type LogSource = { kind: "process" | "build"; id: string };

export type PageKind = "vnc" | "terminal";

export type PageMessage =
  | { page: PageKind; kind: "state"; state: string }
  | { page: PageKind; kind: "need-ticket" }
  | { page: PageKind; kind: "exit"; code: number | null };

export type PageConnection = "loading" | "connecting" | "connected" | "disconnected" | "exited";

export type HubActionId = "display" | "terminal" | "claude" | "build";

export type HubAction = {
  id: HubActionId;
  label: string;
  icon: Icon;
  featured?: boolean;
  hint?: string;
  unavailableHint?: string;
};

export type ResourceGauge = {
  fraction: number;
  value: string;
  unit: string;
};

export type TerminalLaunch = {
  kind: TerminalKind;
  projectId?: string;
};

export type BuildTargetMeta = {
  label: string;
  platform: string;
};

export type BuildTargetOption = BuildTargetMeta & { target: BuildTarget };

export type ProjectField = "name" | "gitUrl" | "branch";

export type ProjectDraft = Record<ProjectField, string>;

export type ProjectDraftErrors = Partial<Record<ProjectField, string>>;

export type CloneJob = {
  projectId: string;
  processId: string;
  gitUrl: string;
};

export type DisplayOutage = {
  reason: "display" | "vnc";
  title: string;
  message: string;
};
