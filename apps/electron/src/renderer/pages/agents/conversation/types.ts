import type { AgentRun, ClaudeSession, InboxItem } from "@theone/protocol";
import type { ReactNode } from "react";
import type { NameLookup } from "../timeline/run-info";
import type { ManageAction, SyncReport } from "./model";

export interface ConversationSyncContext {
  projectId: string;
  compact: boolean;
  running: boolean;
  report(report: SyncReport | null): void;
}

export interface ConversationViewProps {
  runId: string;
  run?: AgentRun | null;
  runs?: readonly AgentRun[];
  names?: NameLookup;
  sessions?: readonly ClaudeSession[];
  inboxItems?: readonly InboxItem[];
  active?: boolean;
  compact?: boolean;
  renderSync?: (context: ConversationSyncContext) => ReactNode;
  discard?: (() => void) | null;
  syncReport?: SyncReport | null;
  onSyncReport?(report: SyncReport | null): void;
  onSelectRun(runId: string): void;
  onRunChanged?(run: AgentRun): void;
  onFollowUpStarted?(run: AgentRun): void;
  onManage?(action: ManageAction, run: AgentRun): void;
  onMarkRead?(item: InboxItem): void;
  onOpenItem?(item: InboxItem): void;
  onOpenTerminal?(terminalId: string): void;
  className?: string;
}
