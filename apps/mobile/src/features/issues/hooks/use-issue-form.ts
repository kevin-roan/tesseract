import { useCallback, useState } from "react";
import type { Issue, IssuePriority, IssueStatus } from "@tesseract/protocol";

import { describeError } from "@/features/sandbox/utils/errors";

import { ISSUE_FORM_COPY } from "../utils/content";
import { claudeWillStart, defaultStatusFor, type IssueAssigneeChoice, assigneeFromChoice } from "../utils/issues";
import { useCreateIssue } from "./use-issue-mutations";

type HumanAssignee = Exclude<IssueAssigneeChoice, "claude">;

type Draft = {
  title: string;
  description: string;
  status: IssueStatus | null;
  priority: IssuePriority;
  claude: boolean;
  human: HumanAssignee;
};

const EMPTY_DRAFT: Draft = { title: "", description: "", status: null, priority: "none", claude: false, human: "me" };

/** The create sheet. Until the user picks a status it follows the controller's default for the assignee. */
export function useIssueForm(projectId: string, onCreated?: (issue: Issue) => void) {
  const create = useCreateIssue();
  const { mutate, reset } = create;
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [invalid, setInvalid] = useState<string | null>(null);

  const assignee = draft.claude ? "claude" : assigneeFromChoice(draft.human);
  const status = draft.status ?? defaultStatusFor(assignee);

  const patch = useCallback(
    (next: Partial<Draft>) => {
      setDraft((current) => ({ ...current, ...next }));
      setInvalid(null);
      reset();
    },
    [reset],
  );

  const open = useCallback(() => {
    reset();
    setInvalid(null);
    setDraft(EMPTY_DRAFT);
    setVisible(true);
  }, [reset]);

  const close = useCallback(() => setVisible(false), []);

  const submit = useCallback(() => {
    if (create.isPending) return;
    const title = draft.title.trim();
    if (!title) {
      setInvalid(ISSUE_FORM_COPY.titleRequired);
      return;
    }
    const description = draft.description.trim();
    mutate(
      { projectId, title, status, priority: draft.priority, assignee, ...(description ? { description } : {}) },
      {
        onSuccess: (issue) => {
          setVisible(false);
          onCreated?.(issue);
        },
      },
    );
  }, [create.isPending, draft, projectId, status, assignee, mutate, onCreated]);

  return {
    open,
    sheet: {
      visible,
      close,
      title: draft.title,
      setTitle: (title: string) => patch({ title }),
      description: draft.description,
      setDescription: (description: string) => patch({ description }),
      status,
      setStatus: (next: IssueStatus) => patch({ status: next }),
      priority: draft.priority,
      setPriority: (priority: IssuePriority) => patch({ priority }),
      claude: draft.claude,
      setClaude: (claude: boolean) => patch({ claude }),
      human: draft.human,
      setHuman: (human: HumanAssignee) => patch({ human }),
      claudeHint: draft.claude
        ? claudeWillStart(assignee, status)
          ? ISSUE_FORM_COPY.claudeStarts
          : ISSUE_FORM_COPY.claudeWaits
        : ISSUE_FORM_COPY.claudeOff,
      error: invalid ?? (create.error ? describeError(create.error) : null),
      saving: create.isPending,
      submit,
    },
  };
}

export type IssueFormState = ReturnType<typeof useIssueForm>["sheet"];
