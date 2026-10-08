import type { AgentRun, ClaudeSession } from "@tesseract/protocol";
import { ListGroup } from "../../../../components/GroupBand";
import { KeyedList } from "../../../../components/KeyedList";
import { RecordRow } from "../../../../components/RecordRow";
import { useConversationsTab } from "./hooks/use-conversations-tab";
import { CONVERSATIONS_LABELS as L } from "./labels";
import { sessionRow } from "./rows";

export interface ConversationsTabProps {
  projectId: string;
  sessions: readonly ClaudeSession[] | null;
  runs: readonly AgentRun[];
}

export function ConversationsTab({ projectId, sessions, runs }: ConversationsTabProps) {
  const tab = useConversationsTab(projectId);
  return (
    <ListGroup
      icon="agents"
      title={L.list}
      count={sessions?.length ?? null}
      actionLabel={L.newChat}
      onAction={tab.newChat}
      loading={sessions === null}
      loadingLabel={L.loading}
      empty={sessions?.length === 0}
      emptyLabel={L.empty}
    >
      <KeyedList
        divided
        label={L.list}
        items={sessions ?? []}
        getKey={(session) => session.sessionId}
        renderItem={(session) => <RecordRow {...sessionRow(session, runs, tab.openSession)} />}
      />
    </ListGroup>
  );
}
