import { useCallback } from "react";

import { describeError, issueForError } from "../utils/errors";
import { issueNotice } from "../utils/states";
import { useSandboxClient } from "./use-sandbox-client";
import { useSandboxIssue } from "./use-sandbox-events";
import { useSandboxNavigation } from "./use-sandbox-navigation";

export function useSandboxProblems(error: Error | null) {
  const nav = useSandboxNavigation();
  const { sandbox, missingToken } = useSandboxClient();
  const linkIssue = useSandboxIssue();
  const issue = linkIssue ?? issueForError(error);

  const repair = useCallback(() => {
    if (sandbox) nav.repair({ url: sandbox.baseUrl, name: sandbox.name });
  }, [nav, sandbox]);

  return {
    missingToken,
    issue: issue ? issueNotice(issue) : null,
    repair,
    error: error && !issue ? describeError(error) : null,
  };
}
