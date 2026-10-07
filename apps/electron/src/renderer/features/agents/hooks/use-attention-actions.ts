import type { InboxItem } from "@theone/protocol";
import { useMemo } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import { useNavigateTo } from "../../../app/navigation";
import { showToast } from "../../../components/Toast";
import { ATTENTION_LABELS, formatLabel } from "../labels";
import { attentionOpenTarget } from "../model";
import { useAgentsUi } from "../store";
import { useInboxCache } from "./use-agent-details";

export interface AttentionActions {
  markRead(item: InboxItem, silent?: boolean): Promise<void>;
  open(item: InboxItem): void;
  openTerminal(terminalId: string): void;
}

export function useAttentionActions(): AttentionActions {
  const client = useApiClient();
  const inbox = useInboxCache();
  const navigateTo = useNavigateTo();

  return useMemo(() => {
    const markRead = async (item: InboxItem, silent = false) => {
      if (!client) return;
      inbox.removeItem(item.id);
      try {
        await client.markInboxRead({ ids: [item.id] });
        if (!silent) showToast(ATTENTION_LABELS.marked);
      } catch (error) {
        showToast(formatLabel(ATTENTION_LABELS.failed, { error: describeError(error) }));
        inbox.refresh();
      }
    };
    const openTerminal = (terminalId: string) => navigateTo("terminals", { terminalId });
    return {
      markRead,
      openTerminal,
      open: (item) => {
        const target = attentionOpenTarget(item);
        if (!target) return;
        if (target.kind === "file") {
          void markRead(item, true);
          navigateTo("files", { artifactId: target.artifactId, projectId: target.projectId });
        } else if (target.kind === "run") {
          useAgentsUi.getState().select(target.runId);
        } else {
          openTerminal(target.terminalId);
        }
      },
    };
  }, [client, inbox, navigateTo]);
}
