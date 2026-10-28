import type { IssuePriority, IssueStatus } from "@tesseract/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EMPTY_DRAFT } from "../constants";
import { canCreate, claudeHint, draftStatus } from "../model";
import type { AssigneeChoice, IssueDraft } from "../types";

export function useIssueDraft(open: boolean, initialStatus: IssueStatus | null) {
  const [draft, setDraft] = useState<IssueDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (open) setDraft({ ...EMPTY_DRAFT, status: initialStatus });
  }, [open, initialStatus]);

  const set = useCallback(<K extends keyof IssueDraft>(key: K, value: IssueDraft[K]) => setDraft((current) => ({ ...current, [key]: value })), []);

  const setters = useMemo(
    () => ({
      title: (value: string) => set("title", value),
      description: (value: string) => set("description", value),
      status: (value: IssueStatus) => set("status", value),
      priority: (value: IssuePriority) => set("priority", value),
      assignee: (value: AssigneeChoice) => set("assignee", value),
      labels: (value: string[]) => set("labels", value),
      claude: (on: boolean) => set("assignee", on ? "claude" : "none"),
    }),
    [set],
  );

  const status = draftStatus(draft);
  return { draft, status, hint: claudeHint(status, draft.assignee), valid: canCreate(draft), set: setters };
}
