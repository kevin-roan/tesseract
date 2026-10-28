import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TesseractClient } from "@tesseract/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HostShellState, HostTerminalKind } from "../../../../../../shared/contracts/hostShell";
import type { HostGitAction } from "../../../../../../shared/contracts/syncback";
import { describeError } from "../../../../../app/connection";
import { createApiClient } from "../../../../../app/data";
import { usePreferencesRoute } from "../../../../../app/navigation";
import { showToast } from "../../../../../components/Toast";
import { HOST_SHELL_STATE_KEY } from "../../../../../features/host-shell/constants";
import type { NoticeAction } from "../../../../../features/projects/types";
import { ipc } from "../../../../../lib/ipc";
import { HOST_SHELL_SECTION } from "../../emulator/constants";
import { isAuthError } from "../../emulator/launcher";
import { hostUnlocked } from "../../emulator/model";
import { HOST_GIT_SYNC_ACTIONS, HOST_LINKS_KEY } from "../constants";
import { HOST_REPO_LABELS as L } from "../labels";
import {
  gitSummary,
  gitTrigger,
  hostFolder,
  hostPathFor,
  hostRepoButton,
  hostShellBlocker,
  isTerminalAction,
  terminalFailure,
  type GitTrigger,
  type HostFolder,
  type HostRepoAction,
  type HostRepoButton,
} from "../model";

export interface HostRepoOptions {
  projectId: string;
  projectName: string;
  report(error: unknown, action?: NoticeAction): void;
}

export interface HostRepo {
  folder: HostFolder | null;
  claude: HostRepoButton;
  shell: HostRepoButton;
  git: GitTrigger;
  sync: HostRepoButton[];
  commit: HostRepoButton;
  message: string;
  setMessage(message: string): void;
  run(action: HostRepoAction): void;
  unlockOpen: boolean;
  closeUnlock(): void;
  unlock(pin: string): Promise<void>;
  onUnlocked(): void;
  chat: HostChatHandle;
}

export interface HostChatHandle {
  open: boolean;
  client: TesseractClient | null;
  close(): void;
}

export function useHostRepo({ projectId, projectName, report }: HostRepoOptions): HostRepo {
  const queryClient = useQueryClient();
  const { openPreferences } = usePreferencesRoute();
  const [busy, setBusy] = useState<HostRepoAction | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chatClient, setChatClient] = useState<TesseractClient | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const pending = useRef<HostTerminalKind | null>(null);
  const links = useQuery({ queryKey: HOST_LINKS_KEY, queryFn: () => ipc.syncback.links(), retry: false });
  const hostPath = hostPathFor(links.data, projectId);

  useEffect(() => ipc.syncback.on("state", () => void queryClient.invalidateQueries({ queryKey: HOST_LINKS_KEY })), [queryClient]);

  const say = useCallback((message: string, action?: NoticeAction) => report(new Error(message), action), [report]);

  const hostReady = useCallback(async (): Promise<HostShellState | null> => {
    const state = await ipc.hostShell.state().catch((): HostShellState | null => null);
    if (state) queryClient.setQueryData(HOST_SHELL_STATE_KEY, state);
    const blocker = hostShellBlocker(state);
    if (blocker === null) return state;
    void ipc.hostShell.refresh().catch(() => undefined);
    say(blocker, { label: L.preferences, run: () => openPreferences(HOST_SHELL_SECTION) });
    return null;
  }, [queryClient, say, openPreferences]);

  const openChat = useCallback(async () => {
    if ((await hostReady()) === null) return;
    setBusy("claude");
    try {
      const target = await ipc.hostShell.openWorkspace(projectId);
      setChatClient(createApiClient({ apiUrl: target.apiUrl, token: target.token }));
      setChatOpen(true);
    } catch (error) {
      say(L.claudeFailed(describeError(error)));
    } finally {
      setBusy(null);
    }
  }, [hostReady, say, projectId]);

  const openTerminal = useCallback(async (kind: HostTerminalKind) => {
    const state = await hostReady();
    if (state === null) return;
    if (!hostUnlocked(state)) {
      pending.current = kind;
      setUnlockOpen(true);
      return;
    }
    setBusy(kind);
    try {
      await ipc.hostShell.openTerminal({ projectId, title: projectName, kind });
    } catch (error) {
      if (isAuthError(error)) {
        pending.current = kind;
        setUnlockOpen(true);
      } else say(terminalFailure(kind, describeError(error)));
    } finally {
      setBusy(null);
    }
  }, [hostReady, say, projectId, projectName]);

  const runGit = useCallback(
    async (action: HostGitAction) => {
      setBusy(action);
      try {
        const result = await ipc.syncback.hostGit(projectId, action, action === "commit" ? message : undefined);
        if (action === "commit") setMessage("");
        showToast(L.done[action](gitSummary(result.output)));
      } catch (error) {
        say(L.failed[action](describeError(error)));
      } finally {
        setBusy(null);
      }
    },
    [projectId, message, say],
  );

  const run = useCallback(
    (action: HostRepoAction) => {
      if (action === "claude") void openChat();
      else if (isTerminalAction(action)) void openTerminal(action);
      else void runGit(action);
    },
    [openChat, openTerminal, runGit],
  );

  const unlock = useCallback(
    async (pin: string) => {
      queryClient.setQueryData(HOST_SHELL_STATE_KEY, await ipc.hostShell.unlock(pin));
    },
    [queryClient],
  );

  const onUnlocked = useCallback(() => {
    const kind = pending.current;
    if (kind === null) return;
    pending.current = null;
    void openTerminal(kind);
  }, [openTerminal]);

  const closeUnlock = useCallback(() => setUnlockOpen(false), []);

  const view = useMemo(() => {
    const commit = hostRepoButton("commit", hostPath, busy);
    return {
      folder: hostFolder(hostPath),
      claude: hostRepoButton("claude", hostPath, busy),
      shell: hostRepoButton("shell", hostPath, busy),
      git: gitTrigger(hostPath, busy),
      sync: HOST_GIT_SYNC_ACTIONS.map((id) => hostRepoButton(id, hostPath, busy)),
      commit: { ...commit, disabled: commit.disabled || message.trim() === "" },
    };
  }, [hostPath, busy, message]);

  const closeChat = useCallback(() => setChatOpen(false), []);
  const chat = useMemo(() => ({ open: chatOpen, client: chatClient, close: closeChat }), [chatOpen, chatClient, closeChat]);

  return { ...view, message, setMessage, run, unlockOpen, closeUnlock, unlock, onUnlocked, chat };
}
