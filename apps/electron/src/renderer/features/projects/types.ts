import type { SemanticColor, Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";

export type ActivityKind = "agent" | "building" | "running" | "idle";
export type ListTab = "all" | "active" | "idle";
export type ProjectTabId = "processes" | "builds" | "artifacts" | "git" | "sync" | "conversations";
export type GroupId = ActivityKind | "all";

export interface ToneLabel {
  label: string;
  tone: Tone;
}

export interface Activity extends ToneLabel {
  kind: ActivityKind;
  running: number;
}

export interface CardModel {
  id: string;
  title: string;
  subtitle: string;
  activity: Activity;
  branch: string | null;
  sync: string | null;
  dirty: ToneLabel | null;
  commit: string | null;
  commitWhen: string;
  tags: string[];
  confidential: ToneLabel | null;
}

export interface CardGroup {
  id: GroupId;
  title: string;
  cards: CardModel[];
}

export type FieldKey = "name" | "git_url" | "branch";
export type ProcessFieldKey = "command" | "name" | "port";

export type ProjectDraftError =
  | "name_required"
  | "name_too_long"
  | "name_invalid"
  | "name_exists"
  | "git_url"
  | "branch_needs_url"
  | "branch_invalid";

export type ProcessDraftError = "command_required" | "command_too_long" | "name_too_long" | "port_invalid";

export interface ProjectDraft {
  name: string;
  gitUrl: string;
  branch: string;
  confidential: boolean;
}

export interface ValidatedProjectDraft {
  errors: Partial<Record<FieldKey, ProjectDraftError>>;
  projectId: string | null;
  name: string;
  gitUrl: string | null;
  branch: string | null;
  confidential: boolean;
  ok: boolean;
}

export interface ProcessDraft {
  command: string;
  name: string;
  port: string;
  display: boolean;
}

export interface ProcessBody {
  projectId: string;
  command: string;
  name?: string;
  port?: number;
  display?: true;
}

export interface ValidatedProcessDraft {
  errors: Partial<Record<ProcessFieldKey, ProcessDraftError>>;
  body: ProcessBody;
  ok: boolean;
}

export interface CloneOutcome extends ToneLabel {
  message: string;
}

export interface RemovalPrompt {
  heading: string;
  body: string;
  confirm: string;
  force: boolean;
}

export interface LogStatus extends ToneLabel {
  live: boolean;
}

export interface PropertyChipModel {
  id: string;
  icon: IconName;
  iconColor: SemanticColor;
  label: string;
  tooltip?: string;
  maxChars?: number;
}

export interface DisplayButtonModel {
  mode: "display" | "emulator" | "unsupported";
  label: string;
  icon: IconName;
  tooltip: string | null;
  disabled: boolean;
}

export interface ChoiceModel {
  id: string;
  label: string;
}

export type ListKind = "processes" | "builds" | "artifacts";

export interface NoticeAction {
  label: string;
  run(): void;
}

export interface ProjectNotice {
  message: string;
  action?: NoticeAction;
  fromPoll: boolean;
}
