import type { AgentRun, ClaudeSession } from "@tesseract/protocol";
import type { RecordRowProps } from "../../../../components/RecordRow";
import { CONVERSATIONS_LABELS as L } from "./labels";
import { sessionMeta, sessionStatus, sessionTarget, sessionTitle } from "./model";

export function sessionRow(session: ClaudeSession, runs: readonly AgentRun[], onOpen: (session: ClaudeSession) => void, now?: number): RecordRowProps {
  const target = sessionTarget(session);
  const open = target ? () => onOpen(session) : undefined;
  return {
    icon: "agents",
    status: sessionStatus(session, runs),
    title: sessionTitle(session),
    subtitle: session.preview,
    meta: sessionMeta(session, now),
    actions: open ? [{ id: "open", icon: "forward", label: L.open, onActivate: open }] : [],
    onActivate: open,
  };
}
