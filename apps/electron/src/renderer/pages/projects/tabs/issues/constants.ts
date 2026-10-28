import type { IssuePriority, IssueStatus } from "@tesseract/protocol";
import type { IconName } from "../../../../theme/icons";
import type { AssigneeChoice, IssueDraft, IssueLayout, IssueScope, StatusAppearance } from "./types";

export const ISSUES_QUERY_KEYS = {
  list: (projectId: string) => ["projects", projectId, "issues"] as const,
  detail: (id: string) => ["issues", id] as const,
};

export const ISSUES_REFRESH_MS = 30_000;
export const CREATE_ISSUE_KEY = "c";
export const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true'], [role='textbox']";
export const SORT_STEP = 1024;
export const CREATE_DIALOG_WIDTH = 640;

export const ISSUE_SCOPES: readonly IssueScope[] = ["all", "claude", "mine"];
export const ISSUE_LAYOUTS: readonly IssueLayout[] = ["board", "list"];
export const ASSIGNEE_CHOICES: readonly AssigneeChoice[] = ["me", "claude", "none"];
export const LAYOUT_ICONS: Record<IssueLayout, IconName> = { board: "board", list: "list" };
export const SCOPE_ICONS: Record<IssueScope, IconName> = { all: "issues", claude: "agents", mine: "assignee" };

export const STATUS_APPEARANCE: Record<IssueStatus, StatusAppearance> = {
  backlog: { icon: "status-backlog", color: "text-tertiary" },
  todo: { icon: "status-todo", color: "text-secondary" },
  in_progress: { icon: "status-progress", color: "warning" },
  in_review: { icon: "status-review", color: "info" },
  done: { icon: "status-done", color: "success" },
  canceled: { icon: "status-canceled", color: "text-tertiary" },
};

export const PRIORITY_BARS: Record<Exclude<IssuePriority, "urgent">, number> = { none: 0, low: 1, medium: 2, high: 3 };
export const PRIORITY_GEOMETRY = { box: 16, bars: 3, barWidth: 3, gap: 1.5, minHeight: 6, maxHeight: 12, radius: 1 } as const;
export const PRIORITY_RANK: Record<IssuePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export const GLYPH_SIZE = { glyph: 14, avatar: 18, spinner: 12 } as const;

export const EMPTY_DRAFT: IssueDraft = { title: "", description: "", status: null, priority: "none", assignee: "none", labels: [] };
export const EMPTY_ICON: IconName = "issues";
