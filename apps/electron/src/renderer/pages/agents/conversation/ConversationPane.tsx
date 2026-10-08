import type { AgentRun } from "@tesseract/protocol";
import { useCallback, useMemo, useState } from "react";
import { useAgentDetails, useRefreshDetails } from "../../../features/agents/hooks/use-agent-details";
import { useAgentProjects, useAgentRuns, useArchivedRuns } from "../../../features/agents/hooks/use-agent-runs";
import { useAttentionActions } from "../../../features/agents/hooks/use-attention-actions";
import { useRunActions } from "../../../features/agents/hooks/use-run-actions";
import { useRunsCache } from "../../../features/agents/hooks/use-runs-cache";
import { useAgentsUi } from "../../../features/agents/store";
import type { ConversationPaneProps } from "../../../features/agents/types";
import { ConversationSyncSlot } from "./ConversationSyncSlot";
import { ConversationView } from "./ConversationView";
import type { ManageAction, SyncReport } from "./model";

export function ConversationPane({ runId, compact }: ConversationPaneProps) {
  const { runs } = useAgentRuns();
  const archived = useArchivedRuns(false).runs;
  const { names } = useAgentProjects();
  const details = useAgentDetails();
  const cache = useRunsCache();
  const refreshDetails = useRefreshDetails();
  const runActions = useRunActions();
  const attention = useAttentionActions();
  const select = useAgentsUi((state) => state.select);

  const known = useMemo(() => [...(runs ?? []), ...(archived ?? [])], [runs, archived]);
  const run = useMemo(() => known.find((candidate) => candidate.id === runId) ?? null, [known, runId]);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const onDiscard = useCallback((next: (() => void) | null) => setDiscard(() => next), []);

  const onManage = useCallback(
    (action: ManageAction, target: AgentRun) => {
      if (action === "delete") runActions.requestDelete([target.id]);
      else void runActions.setArchived([target.id], action === "archive");
    },
    [runActions],
  );

  const onFollowUpStarted = useCallback(
    (started: AgentRun) => {
      cache.upsert(started);
      select(started.id);
      refreshDetails();
    },
    [cache, select, refreshDetails],
  );

  return (
    <ConversationView
      runId={runId}
      run={run}
      runs={known}
      names={names}
      sessions={details.sessions}
      inboxItems={details.items}
      compact={compact}
      discard={discard}
      syncReport={syncReport}
      onSyncReport={setSyncReport}
      renderSync={(context) => <ConversationSyncSlot context={context} onDiscard={onDiscard} />}
      onSelectRun={select}
      onRunChanged={cache.upsert}
      onFollowUpStarted={onFollowUpStarted}
      onManage={onManage}
      onMarkRead={(item) => void attention.markRead(item)}
      onOpenItem={attention.open}
      onOpenTerminal={attention.openTerminal}
    />
  );
}
