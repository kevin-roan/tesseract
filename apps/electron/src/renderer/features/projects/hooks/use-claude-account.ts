import type { ClaudeAccountList, Project } from "@tesseract/protocol";
import { useCallback, useState } from "react";
import { describeError, useConnectionClient } from "../../../app/connection";
import { showToast } from "../../../components/Toast";
import { CLAUDE_ACCOUNT_LABELS } from "../labels";
import { effectiveAccount } from "../model";
import type { NoticeAction } from "../types";

interface Options {
  project: Project | null;
  accounts: ClaudeAccountList | null;
  setProject(project: Project): void;
  report(error: unknown, action?: NoticeAction): void;
}

export function useClaudeAccount({ project, accounts, setProject, report }: Options) {
  const client = useConnectionClient();
  const [busy, setBusy] = useState(false);

  const change = useCallback(
    async (value: string) => {
      if (!project || !client) return;
      const accountId = value || null;
      if (accountId === (project.claudeAccountId ?? null)) return;
      setBusy(true);
      try {
        const updated = await client.setProjectClaudeAccount(project.id, { accountId });
        setProject(updated);
        const account = accounts ? effectiveAccount(updated, accounts) : (accountId ?? "");
        showToast(CLAUDE_ACCOUNT_LABELS.changed(updated.name || updated.id, account));
      } catch (error) {
        report(CLAUDE_ACCOUNT_LABELS.failed(describeError(error)));
      } finally {
        setBusy(false);
      }
    },
    [project, client, accounts, setProject, report],
  );

  return { busy, change };
}
