import type { AgentRun, InboxItem } from "@tesseract/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient, useApiQuery } from "../../../app/data";
import { useNavigateTo } from "../../../app/navigation";
import { copyText } from "../../../components/CopyButton";
import { showToast } from "../../../components/Toast";
import { AGENTS_QUERY_KEYS } from "../../../features/agents/constants";
import { useAgentAttachments } from "../../../features/agents/hooks/use-attachments";
import { useNow } from "../../../features/agents/hooks/use-now";
import { ATTENTION_LABELS, CONVERSATION_LABELS, formatLabel, NEW_LABELS } from "../../../features/agents/labels";
import { isRunning, projectName, runTitle, type NameLookup } from "../timeline/run-info";
import { HEADER_TICK_MS, IDLE_TICK_MS } from "./constants";
import {
  buildNotices,
  canManage,
  followUpState,
  headerActions,
  isFileItem,
  lockedReason,
  menuSections,
  noticeItemsForRun,
  type ManageAction,
  type SyncReport,
} from "./model";
import type { ConversationViewProps } from "./types";
import { useRunFeed } from "./use-run-feed";

const NO_ITEMS: readonly never[] = [];

export type ConversationBodyState = "loading" | "error" | "timeline";

export function useConversation(props: ConversationViewProps) {
  const {
    runId,
    run: knownRun = null,
    names: givenNames,
    sessions = NO_ITEMS,
    inboxItems = NO_ITEMS,
    active = true,
    onSelectRun,
    onRunChanged,
    onFollowUpStarted,
    onManage,
    onMarkRead,
    onOpenItem,
    onOpenTerminal,
    discard = null,
    syncReport: controlledReport,
    onSyncReport,
  } = props;
  const client = useApiClient();
  const navigate = useNavigateTo();
  const feed = useRunFeed(runId, knownRun, active, onRunChanged);
  const run = feed.run;
  const running = isRunning(run);
  const now = useNow(running ? HEADER_TICK_MS : IDLE_TICK_MS, active);

  const projects = useApiQuery(AGENTS_QUERY_KEYS.projects, (api, signal) => api.listProjects({ signal }), {
    enabled: givenNames === undefined,
  });
  const names = useMemo<NameLookup>(
    () => givenNames ?? Object.fromEntries((projects.data ?? []).map((project) => [project.id, project.name])),
    [givenNames, projects.data],
  );

  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [localReport, setLocalReport] = useState<SyncReport | null>(null);
  const syncReport = controlledReport !== undefined ? controlledReport : localReport;
  const setSyncReport = useMemo(() => onSyncReport ?? setLocalReport, [onSyncReport]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const followUp = followUpState(run);
  const attachments = useAgentAttachments(followUp === "ready");
  const { clear: clearAttachments } = attachments;

  useEffect(() => {
    setErrorNotice(null);
    setDraft("");
    setSending(false);
    setConfirmStop(false);
    clearAttachments();
  }, [runId, clearAttachments]);

  const projectId = run?.projectId ?? null;
  useEffect(() => {
    setLocalReport(null);
  }, [projectId]);

  const markRead = useCallback(
    (item: InboxItem) => {
      if (onMarkRead) {
        onMarkRead(item);
        return;
      }
      client?.markInboxRead({ ids: [item.id] }).then(
        () => showToast(ATTENTION_LABELS.marked),
        (error: unknown) => showToast(formatLabel(ATTENTION_LABELS.failed, { error: describeError(error) })),
      );
    },
    [client, onMarkRead],
  );

  const openItem = useCallback(
    (item: InboxItem) => {
      if (onOpenItem) {
        onOpenItem(item);
        return;
      }
      if (isFileItem(item)) {
        void client?.markInboxRead({ ids: [item.id] }).catch(() => undefined);
        navigate("files", { artifactId: item.artifactId, projectId: item.projectId });
      }
    },
    [client, navigate, onOpenItem],
  );

  const openTerminal = useCallback(
    (terminalId: string) => (onOpenTerminal ? onOpenTerminal(terminalId) : navigate("terminals", { terminalId })),
    [navigate, onOpenTerminal],
  );

  const manage = useCallback(
    (action: ManageAction) => {
      if (run && canManage(run)) onManage?.(action, run);
    },
    [onManage, run],
  );

  const copySession = useCallback(() => {
    if (!run?.sessionId) return;
    void copyText(run.sessionId).then(() => showToast(CONVERSATION_LABELS.copied));
  }, [run?.sessionId]);

  const items = useMemo(() => noticeItemsForRun(run, inboxItems), [run, inboxItems]);
  const notices = useMemo(
    () =>
      buildNotices(
        { link: feed.link, error: errorNotice, syncReport, items },
        { dismissError: () => setErrorNotice(null), dismissSync: () => setSyncReport(null), openItem, markRead },
      ),
    [feed.link, errorNotice, syncReport, items, openItem, markRead],
  );

  const sections = useMemo(
    () => menuSections(run, { copySession, reload: feed.reload, discard, remove: () => manage("delete") }),
    [run, copySession, feed.reload, discard, manage],
  );

  const stop = useCallback(() => {
    if (!run || !client) return;
    const id = run.id;
    setStopping(true);
    client.cancelAgentRun(id).then(
      (updated: AgentRun) => {
        setStopping(false);
        feed.updateRun(updated);
        onRunChanged?.(updated);
      },
      (error: unknown) => {
        setStopping(false);
        setErrorNotice(formatLabel(CONVERSATION_LABELS.cancelFailed, { error: describeError(error) }));
      },
    );
  }, [client, feed, onRunChanged, run]);

  const submit = useCallback(
    (text: string) => {
      if (!run || !client || sending || followUpState(run) !== "ready" || !run.sessionId) return;
      setSending(true);
      client
        .startAgentRun({
          prompt: attachments.prompt(text),
          projectId: run.projectId ?? undefined,
          resumeSessionId: run.sessionId,
          attachmentIds: attachments.uploadIds.length > 0 ? attachments.uploadIds : undefined,
        })
        .then(
          (started) => {
            setSending(false);
            setDraft("");
            attachments.clear();
            setErrorNotice(null);
            if (onFollowUpStarted) onFollowUpStarted(started);
            else {
              onRunChanged?.(started);
              onSelectRun(started.id);
            }
          },
          (error: unknown) => {
            const message = formatLabel(NEW_LABELS.failed, { error: describeError(error) });
            setSending(false);
            setErrorNotice(message);
            showToast(message);
          },
        );
    },
    [attachments, client, onFollowUpStarted, onRunChanged, onSelectRun, run, sending],
  );

  const body: ConversationBodyState = run ? "timeline" : feed.error ? "error" : "loading";

  return {
    run,
    events: feed.events,
    error: feed.error,
    reload: feed.reload,
    body,
    now,
    names,
    running,
    header: {
      title: run ? runTitle(run.prompt) : "",
      project: run ? projectName(run.projectId, names) : "",
      actions: headerActions(run, sessions),
      sections,
      stopping,
      openTerminal,
      manage,
      requestStop: () => setConfirmStop(true),
    },
    stopDialog: { open: confirmStop, close: () => setConfirmStop(false), confirm: stop },
    notices,
    syncReport: setSyncReport,
    composer: {
      value: draft,
      onChange: setDraft,
      onSubmit: submit,
      busy: sending,
      locked: lockedReason(followUp),
      attachments,
    },
  };
}

export type ConversationModel = ReturnType<typeof useConversation>;
