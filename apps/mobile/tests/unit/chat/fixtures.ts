import { SparkleIcon } from "phosphor-react-native";

import type { ChatComposerState } from "@/features/chat/hooks/use-chat-composer";
import { AGENT_MODE_OPTIONS, AGENT_MODE_SHEET } from "@/features/chat/utils/modes";
import { ATTACH_OPTIONS } from "@/features/attachments/utils/sources";

type Overrides = Partial<Omit<ChatComposerState, "voice" | "attachments" | "newProject">> & {
  newProject?: Partial<ChatComposerState["newProject"]>;
  voice?: Partial<ChatComposerState["voice"]>;
  attachments?: Partial<ChatComposerState["attachments"]>;
};

export function chatComposerState({ voice, attachments, newProject, ...overrides }: Overrides = {}): ChatComposerState {
  return {
    text: "",
    setText: jest.fn(),
    projectId: null,
    mode: {
      id: "bypassPermissions",
      label: "Auto",
      detail: "Full access",
      description: "Full access to edit files and run commands.",
      badge: "Default",
      icon: SparkleIcon,
      options: AGENT_MODE_OPTIONS,
      sheet: AGENT_MODE_SHEET,
      select: jest.fn(),
    },
    project: null,
    attach: { options: ATTACH_OPTIONS, select: jest.fn(), enabled: true },
    clipboard: { canPaste: false, paste: jest.fn(), onFocus: jest.fn(), onBlur: jest.fn() },
    newProject: {
      visible: false,
      name: "",
      setName: jest.fn(),
      error: null,
      hint: "",
      creating: false,
      create: jest.fn(),
      skip: jest.fn(),
      close: jest.fn(),
      ...newProject,
    },
    sheet: null,
    openSheet: jest.fn(),
    closeSheet: jest.fn(),
    onSheetDismissed: jest.fn(),
    attachments: {
      items: [],
      notice: null,
      pick: jest.fn(),
      add: jest.fn(),
      addUploaded: jest.fn(),
      remove: jest.fn(),
      retry: jest.fn(),
      clear: jest.fn(),
      dismissNotice: jest.fn(),
      uploadIds: [],
      isUploading: false,
      hasFailed: false,
      canAttach: true,
      ...attachments,
    },
    voice: {
      phase: "idle",
      active: false,
      levels: [],
      elapsedLabel: "0:00",
      error: null,
      start: jest.fn(),
      stop: jest.fn(),
      cancel: jest.fn(),
      retry: jest.fn(),
      discard: jest.fn(),
      clearError: jest.fn(),
      fallback: null,
      dismissFallback: jest.fn(),
      ...voice,
    },
    primary: "mic",
    canSend: false,
    locked: false,
    send: jest.fn(),
    startVoice: jest.fn(),
    sending: false,
    error: null,
    dismissError: jest.fn(),
    notice: null,
    dismissNotice: jest.fn(),
    ...overrides,
  };
}
