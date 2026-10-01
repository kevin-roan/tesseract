import { useCallback, useMemo, useRef, useState } from "react";
import { isApiError } from "@theone/client";
import { LIMITS, type AgentRun, type AgentRunMode } from "@theone/protocol";

import type { ChoiceOption } from "@/components/choice-group";
import type { MenuOption } from "@/components/menu-sheet/types";
import { useAttachments } from "@/features/attachments/hooks/use-attachments";
import { useClipboardImage } from "@/features/attachments/hooks/use-clipboard-image";
import type { PickerSource } from "@/features/attachments/types";
import { defaultPromptFor } from "@/features/attachments/utils/files";
import { ATTACH_OPTIONS, isPickerSource } from "@/features/attachments/utils/sources";
import { useDraftInjection } from "@/features/island/hooks/use-draft-injection";
import { useCreateProject, useStartAgentRun } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { describeError } from "@/features/sandbox/utils/errors";
import { useVoiceMessage, type VoiceNote } from "@/features/voice/hooks/use-voice-message";

import { AGENT_MODE_DETAILS, AGENT_MODE_OPTIONS, AGENT_MODE_SHEET, DEFAULT_AGENT_MODE, isAgentMode } from "../utils/modes";
import { projectNameCandidate, projectNameFromPrompt } from "../utils/project-name";

const PROJECT_NAME_ATTEMPTS = 20;

export type ComposerSheet = "mode" | "attach" | "project";

type ChatComposerOptions = {
  defaultProjectId?: string | null;
  projectOptions?: ChoiceOption[];
  resumeSessionId?: string | null;
  defaultMode?: AgentRunMode | null;
  onStarted: (run: AgentRun) => void;
};

export type ChatComposerState = ReturnType<typeof useChatComposer>;

export function useChatComposer({
  defaultProjectId = null,
  projectOptions,
  resumeSessionId = null,
  defaultMode = null,
  onStarted,
}: ChatComposerOptions) {
  const [text, setText] = useState("");
  const [chosenMode, setChosenMode] = useState<AgentRunMode | null>(null);
  const [chosenProjectId, setChosenProjectId] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState<ComposerSheet | null>(null);
  const queuedSourceRef = useRef<PickerSource | null>(null);
  /** Set synchronously so taps that land before the pending state re-renders cannot start a second run. */
  const inFlightRef = useRef(false);
  const attachments = useAttachments();
  const clipboard = useClipboardImage();
  const start = useStartAgentRun();
  const createProject = useCreateProject();
  const { mutateAsync } = start;
  const { mutateAsync: createProjectAsync } = createProject;
  const { clear: clearAttachments, add: addAttachments } = attachments;
  useDraftInjection({ setText, add: addAttachments });

  const mode = chosenMode ?? defaultMode ?? DEFAULT_AGENT_MODE;
  const projectId = chosenProjectId === undefined ? defaultProjectId : chosenProjectId;

  /** A new chat without a project gets its own folder, named after the prompt, instead of running in the workspace root. */
  const createProjectFor = useCallback(
    async (prompt: string) => {
      const base = projectNameFromPrompt(prompt);
      for (let attempt = 1; ; attempt += 1) {
        try {
          const { project } = await createProjectAsync({ name: projectNameCandidate(base, attempt) });
          return project.id;
        } catch (error) {
          if (!isApiError(error, "conflict") || attempt >= PROJECT_NAME_ATTEMPTS) throw error;
        }
      }
    },
    [createProjectAsync],
  );

  const startRun = useCallback(
    async (prompt: string, attachmentIds: string[]) => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      let run: AgentRun;
      try {
        const targetProjectId = projectId ?? (resumeSessionId ? null : await createProjectFor(prompt));
        if (targetProjectId && targetProjectId !== projectId) setChosenProjectId(targetProjectId);
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
    [mutateAsync, mode, projectId, resumeSessionId, createProjectFor, clearAttachments, onStarted],
  );

  const onVoiceReady = useCallback(
    ({ prompt, audio }: VoiceNote) => startRun(prompt, [...attachments.uploadIds, audio.id]),
    [startRun, attachments.uploadIds],
  );
  const voice = useVoiceMessage({ onReady: onVoiceReady });

  const trimmed = text.trim();
  const hasDraft = trimmed.length > 0 || attachments.items.length > 0;
  const canSend =
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
    startRun(prompt, attachments.uploadIds).catch(() => undefined);
  }, [canSend, trimmed, attachments.items, attachments.uploadIds, startRun]);

  const { start: startRecording, clearError: clearVoiceError } = voice;
  const sending = start.isPending || createProject.isPending;
  const startVoice = useCallback(() => {
    if (sending) return;
    clearVoiceError();
    void startRecording();
  }, [sending, clearVoiceError, startRecording]);

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
  const { reset: resetCreateProject } = createProject;
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
    sheet,
    openSheet,
    closeSheet,
    onSheetDismissed,
    attachments,
    voice,
    primary: hasDraft ? ("send" as const) : ("mic" as const),
    canSend,
    send,
    startVoice,
    sending,
    error,
    dismissError,
  };
}
