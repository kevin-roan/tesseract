import type { Issue, IssueStatus } from "@tesseract/protocol";
import { useCallback, useState } from "react";
import type { IssueDraft } from "../types";
import { useIssueDraft } from "./use-issue-draft";

export function useCreateIssue(open: boolean, initialStatus: IssueStatus | null, onCreate: (draft: IssueDraft) => Promise<Issue | null>) {
  const form = useIssueDraft(open, initialStatus);
  const [busy, setBusy] = useState(false);
  const { draft, valid } = form;

  const submit = useCallback(async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onCreate(draft);
    } finally {
      setBusy(false);
    }
  }, [valid, busy, onCreate, draft]);

  return { ...form, busy, submit };
}
