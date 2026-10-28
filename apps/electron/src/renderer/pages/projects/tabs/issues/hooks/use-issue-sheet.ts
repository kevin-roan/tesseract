import type { Issue, IssuePriority, IssueStatus } from "@tesseract/protocol";
import { useCallback, useMemo, useState } from "react";
import { descriptionUpdate, titleUpdate, toAssignee } from "../model";
import type { AssigneeChoice } from "../types";
import type { IssueActions } from "./use-issue-actions";
import { useIssueDetail } from "./use-issue-detail";

export function useIssueSheet(issue: Issue | null, actions: IssueActions, onClose: () => void) {
  const id = issue?.id ?? null;
  const { detail } = useIssueDetail(id);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const setters = useMemo(() => {
    const update = (patch: Parameters<IssueActions["update"]>[1] | null) => {
      if (id && patch) void actions.update(id, patch);
    };
    return {
      title: (value: string) => issue && update(titleUpdate(issue, value)),
      description: (value: string) => issue && update(descriptionUpdate(issue, value)),
      status: (status: IssueStatus) => update({ status }),
      priority: (priority: IssuePriority) => update({ priority }),
      assignee: (choice: AssigneeChoice) => update({ assignee: toAssignee(choice) }),
      labels: (labels: string[]) => update({ labels }),
    };
  }, [id, issue, actions]);

  const dispatch = useCallback(() => {
    if (id) void actions.dispatch(id);
  }, [id, actions]);

  const send = useCallback(
    async (body: string) => {
      if (!id || sending) return;
      setSending(true);
      try {
        if (await actions.comment(id, body)) setComment("");
      } finally {
        setSending(false);
      }
    },
    [id, sending, actions],
  );

  const confirmDelete = useCallback(async () => {
    if (id && (await actions.remove(id))) onClose();
  }, [id, actions, onClose]);

  return {
    comments: detail?.comments ?? null,
    set: setters,
    dispatch,
    comment,
    setComment,
    sending,
    send,
    confirmingDelete,
    askDelete: () => setConfirmingDelete(true),
    cancelDelete: () => setConfirmingDelete(false),
    confirmDelete,
  };
}
