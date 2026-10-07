import type { AgentRun, ClaudeSession, InboxItem } from "@theone/protocol";
import type { MenuSections } from "../../../components/ActionMenu";
import { ATTENTION_LABELS, CONVERSATION_LABELS, MANAGE_LABELS } from "../../../features/agents/labels";
import type { Tone } from "../../../theme/colors";
import type { IconName } from "../../../theme/icons";
import {
  canManage,
  followUpState,
  isArchived,
  isAttentionItem,
  isFileItem,
  noticeStyle,
  terminalForRun,
  type FollowUpState,
} from "../../../features/agents/model";
import { SYNC_MENU_LABELS } from "./labels";
import type { LinkState } from "./feed";

export { canManage, followUpState, isArchived, isFileItem, noticeStyle, terminalForRun, type FollowUpState };

export type ManageAction = "archive" | "unarchive" | "delete";

export interface SyncReport {
  message: string;
  tone: Tone;
}

export interface ConversationNotice {
  key: string;
  message: string;
  tone: Tone;
  title?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}

export interface HeaderActions {
  stop: boolean;
  terminalId: string | null;
  sync: boolean;
  archive: boolean;
  unarchive: boolean;
}

export function lockedReason(state: FollowUpState): string | null {
  if (state === "running") return CONVERSATION_LABELS.followUpRunning;
  if (state === "no_session") return CONVERSATION_LABELS.followUpNoSession;
  return null;
}

export function isNoticeItem(item: InboxItem): boolean {
  return !item.readAt && (isAttentionItem(item) || isFileItem(item));
}

export function noticeItemsForRun(run: AgentRun | null, items: readonly InboxItem[]): InboxItem[] {
  if (!run) return [];
  const session = run.sessionId;
  return items.filter(
    (item) => isNoticeItem(item) && (item.agentRunId === run.id || (Boolean(session) && item.sessionId === session && !item.agentRunId)),
  );
}

export function headerActions(run: AgentRun | null, sessions: readonly ClaudeSession[]): HeaderActions {
  const manageable = canManage(run);
  const archived = isArchived(run);
  return {
    stop: run?.state === "running",
    terminalId: terminalForRun(run, sessions),
    sync: Boolean(run?.projectId),
    archive: manageable && !archived,
    unarchive: manageable && archived,
  };
}

export interface NoticeInput {
  link: LinkState;
  error: string | null;
  syncReport: SyncReport | null;
  items: readonly InboxItem[];
}

export interface NoticeHandlers {
  dismissError(): void;
  dismissSync(): void;
  openItem(item: InboxItem): void;
  markRead(item: InboxItem): void;
}

export function buildNotices({ link, error, syncReport, items }: NoticeInput, handlers: NoticeHandlers): ConversationNotice[] {
  const notices: ConversationNotice[] = [];
  if (link === "reconnecting") notices.push({ key: "link", message: CONVERSATION_LABELS.reconnecting, tone: "warning" });
  else if (link === "polling") notices.push({ key: "link", message: CONVERSATION_LABELS.polling, tone: "info" });
  if (error) {
    notices.push({ key: "error", message: error, tone: "danger", actionLabel: CONVERSATION_LABELS.dismiss, onAction: handlers.dismissError });
  }
  if (syncReport) {
    notices.push({
      key: "sync",
      message: syncReport.message,
      tone: syncReport.tone,
      actionLabel: CONVERSATION_LABELS.dismiss,
      onAction: handlers.dismissSync,
    });
  }
  for (const item of items) {
    const style = noticeStyle(item);
    const file = isFileItem(item);
    notices.push({
      key: `item-${item.id}`,
      message: item.body,
      title: item.title,
      tone: style.tone,
      icon: style.icon,
      actionLabel: file ? ATTENTION_LABELS.download : ATTENTION_LABELS.markRead,
      onAction: file ? () => handlers.openItem(item) : () => handlers.markRead(item),
    });
  }
  return notices;
}

export interface MenuHandlers {
  copySession(): void;
  reload(): void;
  discard: (() => void) | null;
  remove(): void;
}

export function menuSections(run: AgentRun | null, handlers: MenuHandlers): MenuSections {
  if (!run) return [];
  const general = [];
  if (run.sessionId) general.push({ id: "copy-session", label: CONVERSATION_LABELS.copySession, onSelect: handlers.copySession });
  if (run.state !== "running") general.push({ id: "reload", label: CONVERSATION_LABELS.reload, onSelect: handlers.reload });
  const destructive = [];
  if (run.projectId && handlers.discard) destructive.push({ id: "discard", label: SYNC_MENU_LABELS.discard, onSelect: handlers.discard, danger: true });
  if (canManage(run)) destructive.push({ id: "delete", label: MANAGE_LABELS.delete, onSelect: handlers.remove, danger: true });
  return [general, destructive];
}
