import { useCallback, useState } from "react";
import type { Issue } from "@tesseract/protocol";

import { describeError } from "@/features/sandbox/utils/errors";

import { ISSUES_COPY } from "../utils/content";
import { isIssueStatus, issueIdentifier } from "../utils/issues";
import { STATUS_OPTIONS } from "../utils/options";
import { useUpdateIssue } from "./use-issue-mutations";

export function useIssueStatusSheet() {
  const update = useUpdateIssue();
  const { mutate } = update;
  const [target, setTarget] = useState<Issue | null>(null);

  const close = useCallback(() => setTarget(null), []);

  const select = useCallback(
    (id: string) => {
      if (target && isIssueStatus(id) && id !== target.status) mutate({ id: target.id, status: id });
      setTarget(null);
    },
    [target, mutate],
  );

  return {
    open: setTarget,
    error: update.error ? describeError(update.error) : null,
    sheet: {
      visible: target !== null,
      title: target ? `${issueIdentifier(target)} · ${ISSUES_COPY.statusSheet}` : ISSUES_COPY.statusSheet,
      options: STATUS_OPTIONS,
      selectedId: target?.status ?? null,
      onSelect: select,
      onClose: close,
    },
  };
}
