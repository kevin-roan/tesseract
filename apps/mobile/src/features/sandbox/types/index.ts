import type { ConnectionState } from "@theone/client";
import type { AgentRun, BuildJob, BuildTarget, ProcessInfo, TerminalKind, VncAction } from "@theone/protocol";
import type { Icon } from "phosphor-react-native";

import type { ActivityItemProps } from "@/components/activity-item";
import type { ProjectCardProps } from "@/components/project-card";
import type { SurfaceTone } from "@/theme";

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

export type PageKind = "vnc" | "terminal" | "android";

export type PageMessage =
  | { page: PageKind; kind: "state"; state: string }
  | { page: PageKind; kind: "need-ticket" }
  | { page: PageKind; kind: "exit"; code: number | null }
  | { page: PageKind; kind: "action"; action: VncAction };

export type PageInsets = { top: number; bottom: number };

export type PageConnection = "loading" | "connecting" | "connected" | "disconnected" | "exited";

export type HubActionId = "display" | "terminal" | "claude" | "build";

export type HubAction = {
  id: HubActionId;
  label: string;
  icon: Icon;
  tone?: SurfaceTone;
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

export type ProfileView = {
  name: string;
  tagline: string;
  team?: string;
  photo?: string;
};

export type ActivityRef =
  | { kind: "build"; id: string }
  | { kind: "run"; id: string }
  | { kind: "process"; id: string; projectId: string | null };

export type ActivityEntry = {
  id: string;
  ref: ActivityRef;
  time: number;
  item: Omit<ActivityItemProps, "onPress" | "testID">;
};

export type ActivityActor = {
  name: string;
  photo?: string;
};

export type ActiveWork = {
  processes: ProcessInfo[];
  builds: BuildJob[];
  runs: AgentRun[];
};

export type ProjectActivity = "building" | "agent" | "running" | "failed" | "idle";

export type ProjectCardModel = Omit<ProjectCardProps, "onPress" | "onPressMenu" | "onPressChat" | "chatLabel" | "testID"> & {
  id: string;
};
