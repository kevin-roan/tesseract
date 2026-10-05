import { useCallback, useMemo, useRef, useState } from "react";
import { isApiError } from "@theone/client";
import { LIMITS, projectIdFromName, type AgentRun, type AgentRunMode } from "@theone/protocol";

import type { ChoiceOption } from "@/components/choice-group";
import type { MenuOption } from "@/components/menu-sheet/types";
import { useAttachments } from "@/features/attachments/hooks/use-attachments";
import { useClipboardImage } from "@/features/attachments/hooks/use-clipboard-image";
import type { PickerSource } from "@/features/attachments/types";
import { defaultPromptFor } from "@/features/attachments/utils/files";
import { ATTACH_OPTIONS, isPickerSource } from "@/features/attachments/utils/sources";
import { useDraftInjection } from "@/features/island/hooks/use-draft-injection";
import { useCreateProject, useStartAgentRun } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { PROJECTS_ROOT } from "@/features/sandbox/utils/constants";
import { describeError } from "@/features/sandbox/utils/errors";
import { projectLocationHint } from "@/features/sandbox/utils/new-project";
import { useVoiceMessage, type VoiceNote } from "@/features/voice/hooks/use-voice-message";

import { AGENT_MODE_DETAILS, AGENT_MODE_OPTIONS, AGENT_MODE_SHEET, DEFAULT_AGENT_MODE, isAgentMode } from "../utils/modes";
import { freeProjectName, projectNameError } from "../utils/project-name";

export type ComposerSheet = "mode" | "attach" | "project" | "new-project";

/** A new chat waiting for the user to name a project for it or go without one. */
type PendingChat = { prompt: string; attachmentIds: string[] };

type ChatComposerOptions = {
  defaultProjectId?: string | null;
  projectOptions?: ChoiceOption[];
  resumeSessionId?: string | null;
  defaultMode?: AgentRunMode | null;
  /** The user can draft but not send, e.g. while the run being continued is still working. */
  locked?: boolean;
  onStarted: (run: AgentRun) => void;
};

export type ChatComposerState = ReturnType<typeof useChatComposer>;

export function useChatComposer({
  defaultProjectId = null,
  projectOptions,
  resumeSessionId = null,
  defaultMode = null,
  locked = false,
  onStarted,
}: ChatComposerOptions) {
  const [text, setText] = useState("");
  const [chosenMode, setChosenMode] = useState<AgentRunMode | null>(null);
  const [chosenProjectId, setChosenProjectId] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState<ComposerSheet | null>(null);
  const [pendingChat, setPendingChat] = useState<PendingChat | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectNameIssue, setProjectNameIssue] = useState<string | null>(null);
  const queuedSourceRef = useRef<PickerSource | null>(null);
  /** Set synchronously so taps that land before the pending state re-renders cannot start a second run. */
  const inFlightRef = useRef(false);
  const attachments = useAttachments();
  const clipboard = useClipboardImage();
  const start = useStartAgentRun();
  const createProject = useCreateProject();
  const { mutateAsync } = start;
  const { mutateAsync: createProjectAsync } = createProject;
  const { reset: resetCreateProject } = createProject;
  const { clear: clearAttachments, add: addAttachments } = attachments;
  useDraftInjection({ setText, add: addAttachments });

  const mode = chosenMode ?? defaultMode ?? DEFAULT_AGENT_MODE;
  const projectId = chosenProjectId === undefined ? defaultProjectId : chosenProjectId;

  /** A new chat with no project picked asks first; one where the user cleared the project runs in the workspace root. */
  const asksForProject = projectId === null && chosenProjectId === undefined && !resumeSessionId;

  const startRun = useCallback(
    async (prompt: string, attachmentIds: string[], targetProjectId: string | null) => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      let run: AgentRun;
      try {
        run = await mutateAsync({
          prompt,
          mode,
          ...(attachmentIds.length > 0 ? { attachmentIds: attachmentIds.slice(-LIMITS.maxRunAttachments) } : {}),
          ...(targetProjectId ? { projectId: targetProjectId } : {}),
          ...(resumeSessionId ? { resumeSessionId } : {}),
        });
      } finally {
        inFlightRef.current = false;
      }
      setText("");
      clearAttachments();
      onStarted(run);
      return run;
    },
    [mutateAsync, mode, resumeSessionId, clearAttachments, onStarted],
  );

  const existingProjectIds = useMemo(() => (projectOptions ?? []).map((option) => option.id), [projectOptions]);

  const submit = useCallback(
    async (prompt: string, attachmentIds: string[]) => {
      if (!asksForProject) return startRun(prompt, attachmentIds, projectId);
      setPendingChat({ prompt, attachmentIds });
      setProjectName(freeProjectName(prompt, existingProjectIds));
      setProjectNameIssue(null);
      setSheet("new-project");
      return null;
    },
    [asksForProject, startRun, projectId, existingProjectIds],
  );

  const changeProjectName = useCallback((name: string) => {
    setProjectName(name);
    setProjectNameIssue(null);
  }, []);

  const createAndStart = useCallback(async () => {
    if (!pendingChat || inFlightRef.current) return;
    const name = projectName.trim();
    const issue = projectNameError(name, existingProjectIds);
    if (issue) {
      setProjectNameIssue(issue);
      return;
    }
    let createdId: string;
    try {
      ({
        project: { id: createdId },
      } = await createProjectAsync({ name }));
    } catch (cause) {
      resetCreateProject();
      setProjectNameIssue(
        isApiError(cause, "conflict") ? `${PROJECTS_ROOT}/${projectIdFromName(name) ?? name} already exists.` : describeError(cause),
      );
      return;
    }
    setChosenProjectId(createdId);
    setPendingChat(null);
    setSheet(null);
    await startRun(pendingChat.prompt, pendingChat.attachmentIds, createdId).catch(() => undefined);
  }, [pendingChat, projectName, existingProjectIds, createProjectAsync, resetCreateProject, startRun]);

  const startWithoutProject = useCallback(() => {
    if (!pendingChat) return;
    setChosenProjectId(null);
    setPendingChat(null);
    setSheet(null);
    startRun(pendingChat.prompt, pendingChat.attachmentIds, null).catch(() => undefined);
  }, [pendingChat, startRun]);

  /** Backing out keeps the message: a voice note's transcript lands in the empty input. */
  const closeNewProject = useCallback(() => {
    if (pendingChat) setText((current) => (current.trim() ? current : pendingChat.prompt));
    setPendingChat(null);
    setSheet(null);
  }, [pendingChat]);

  const onVoiceReady = useCallback(
    ({ prompt, audio }: VoiceNote) => submit(prompt, [...attachments.uploadIds, audio.id]),
    [submit, attachments.uploadIds],
  );
  const voice = useVoiceMessage({ onReady: onVoiceReady });

  const trimmed = text.trim();
  const hasDraft = trimmed.length > 0 || attachments.items.length > 0;
  const canSend =
    !locked &&
    hasDraft &&
    trimmed.length <= LIMITS.maxPromptLength &&
    !attachments.isUploading &&
    !attachments.hasFailed &&
    !start.isPending &&
    !createProject.isPending &&
    !voice.active;

  const send = useCallback(() => {
    if (!canSend) return;
    const prompt = trimmed || defaultPromptFor(attachments.items);
    submit(prompt, attachments.uploadIds).catch(() => undefined);
  }, [canSend, trimmed, attachments.items, attachments.uploadIds, submit]);

  const { start: startRecording, clearError: clearVoiceError } = voice;
  const sending = start.isPending || createProject.isPending;
  const startVoice = useCallback(() => {
    if (sending || locked) return;
    clearVoiceError();
    void startRecording();
  }, [sending, locked, clearVoiceError, startRecording]);

  const { refresh: refreshClipboard, consume: consumeClipboard } = clipboard;
  const openSheet = useCallback(
    (next: ComposerSheet) => {
      if (next === "attach") void refreshClipboard();
      setSheet(next);
    },
    [refreshClipboard],
  );
  const closeSheet = useCallback(() => setSheet(null), []);

  const selectMode = useCallback((id: string) => {
    if (isAgentMode(id)) setChosenMode(id);
    setSheet(null);
  }, []);

  const selectProject = useCallback(
    (id: string) => {
      setChosenProjectId((current) => ((current === undefined ? defaultProjectId : current) === id ? null : id));
      setSheet(null);
    },
    [defaultProjectId],
  );

  const selectAttachSource = useCallback((id: string) => {
    queuedSourceRef.current = isPickerSource(id) ? id : null;
    setSheet(null);
  }, []);

  const { pick } = attachments;
  const pickSource = useCallback(
    (source: PickerSource) => {
      if (source === "clipboard") consumeClipboard();
      void pick(source);
    },
    [pick, consumeClipboard],
  );

  const onSheetDismissed = useCallback(() => {
    const source = queuedSourceRef.current;
    queuedSourceRef.current = null;
    if (source) pickSource(source);
  }, [pickSource]);

  const pasteImage = useCallback(() => pickSource("clipboard"), [pickSource]);

  const attachOptions = useMemo(
    () => (clipboard.hasImage ? ATTACH_OPTIONS : ATTACH_OPTIONS.filter((option) => option.id !== "clipboard")),
    [clipboard.hasImage],
  );

  const projectMenu = useMemo<MenuOption[] | null>(
    () => (projectOptions && projectOptions.length > 0 ? projectOptions : null),
    [projectOptions],
  );
  const projectLabel = projectOptions?.find((option) => option.id === projectId)?.label ?? projectId;

  const { dismissNotice } = attachments;
  const { reset: resetStart } = start;
  const idleVoiceError = voice.phase === "idle" ? voice.error : null;
  const requestError = start.error ?? createProject.error;
  const error = idleVoiceError ?? attachments.notice ?? (requestError && !voice.active ? describeError(requestError) : null);
  const dismissError = useCallback(() => {
    clearVoiceError();
    dismissNotice();
    resetStart();
    resetCreateProject();
  }, [clearVoiceError, dismissNotice, resetStart, resetCreateProject]);

  return {
    text,
    setText,
    projectId,
    mode: { id: mode, ...AGENT_MODE_DETAILS[mode], options: AGENT_MODE_OPTIONS, sheet: AGENT_MODE_SHEET, select: selectMode },
    project: projectMenu ? { id: projectId, label: projectLabel, options: projectMenu, select: selectProject } : null,
    attach: { options: attachOptions, select: selectAttachSource, enabled: attachments.canAttach },
    clipboard: {
      canPaste: clipboard.hasImage && attachments.canAttach && !sending,
      paste: pasteImage,
      onFocus: clipboard.onFocus,
      onBlur: clipboard.onBlur,
    },
    newProject: {
      visible: sheet === "new-project",
      name: projectName,
      setName: changeProjectName,
      error: projectNameIssue,
      hint: projectLocationHint(projectName),
      creating: createProject.isPending,
      create: createAndStart,
      skip: startWithoutProject,
      close: closeNewProject,
    },
    sheet,
    openSheet,
    closeSheet,
    onSheetDismissed,
    attachments,
    voice,
    primary: hasDraft ? ("send" as const) : ("mic" as const),
    canSend,
    locked,
    send,
    startVoice,
    sending,
    error,
    dismissError,
    notice: voice.phase === "idle" ? voice.fallback : null,
    dismissNotice: voice.dismissFallback,
  };
}
