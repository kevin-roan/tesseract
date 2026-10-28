import type { IssueAssignee, IssuePriority, IssueStatus } from "@tesseract/protocol";
import type { SemanticColor } from "../../../../theme/colors";
import type { IconName } from "../../../../theme/icons";

export type IssueScope = "all" | "claude" | "mine";
export type IssueLayout = "board" | "list";
export type AssigneeChoice = IssueAssignee | "none";
export type AgentIndicator = "running" | "failed" | null;
export type ClaudeHint = "starts" | "waits" | null;

export interface StatusAppearance {
  icon: IconName;
  color: SemanticColor;
}

export interface IssueDraft {
  title: string;
  description: string;
  status: IssueStatus | null;
  priority: IssuePriority;
  assignee: AssigneeChoice;
  labels: string[];
}

export interface IssueColumn<T> {
  status: IssueStatus;
  issues: T[];
}

export interface DropPosition {
  status: IssueStatus;
  beforeId: string | null;
}
