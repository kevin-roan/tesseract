import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HostShellState } from "../../../../../../shared/contracts/hostShell";
import type { HostGitAction } from "../../../../../../shared/contracts/syncback";
import { describeError } from "../../../../../app/connection";
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
  hostPathFor,
  hostRepoButton,
  hostShellBlocker,
  type GitTrigger,
  type HostRepoAction,
  type HostRepoButton,
} from "../model";

export interface HostRepoOptions {
  projectId: string;
  projectName: string;
  report(error: unknown, action?: NoticeAction): void;
}

export interface HostRepo {
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
}

export function useHostRepo({ projectId, projectName, report }: HostRepoOptions): HostRepo {
  const queryClient = useQueryClient();
  const { openPreferences } = usePreferencesRoute();
  const [busy, setBusy] = useState<HostRepoAction | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const links = useQuery({ queryKey: HOST_LINKS_KEY, queryFn: () => ipc.syncback.links(), retry: false });
  const hostPath = hostPathFor(links.data, projectId);

  useEffect(() => ipc.syncback.on("state", () => void queryClient.invalidateQueries({ queryKey: HOST_LINKS_KEY })), [queryClient]);

  const say = useCallback((message: string, action?: NoticeAction) => report(new Error(message), action), [report]);

  const openShell = useCallback(async () => {
    const state = await ipc.hostShell.state().catch((): HostShellState | null => null);
    if (state) queryClient.setQueryData(HOST_SHELL_STATE_KEY, state);
    const blocker = hostShellBlocker(state);
    if (blocker !== null) {
      void ipc.hostShell.refresh().catch(() => undefined);
      say(blocker, { label: L.preferences, run: () => openPreferences(HOST_SHELL_SECTION) });
      return;
    }
    if (!hostUnlocked(state)) {
      pending.current = true;
      setUnlockOpen(true);
      return;
    }
    setBusy("shell");
    try {
      await ipc.hostShell.openTerminal({ projectId, title: projectName });
    } catch (error) {
      if (isAuthError(error)) {
        pending.current = true;
        setUnlockOpen(true);
      } else say(L.shellFailed(describeError(error)));
    } finally {
      setBusy(null);
    }
  }, [queryClient, say, openPreferences, projectId, projectName]);

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
      if (action === "shell") void openShell();
      else void runGit(action);
    },
    [openShell, runGit],
  );

  const unlock = useCallback(
    async (pin: string) => {
      queryClient.setQueryData(HOST_SHELL_STATE_KEY, await ipc.hostShell.unlock(pin));
    },
    [queryClient],
  );

  const onUnlocked = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    void openShell();
  }, [openShell]);

  const closeUnlock = useCallback(() => setUnlockOpen(false), []);

  const view = useMemo(() => {
    const commit = hostRepoButton("commit", hostPath, busy);
    return {
      shell: hostRepoButton("shell", hostPath, busy),
      git: gitTrigger(hostPath, busy),
      sync: HOST_GIT_SYNC_ACTIONS.map((id) => hostRepoButton(id, hostPath, busy)),
      commit: { ...commit, disabled: commit.disabled || message.trim() === "" },
    };
  }, [hostPath, busy, message]);

  return { ...view, message, setMessage, run, unlockOpen, closeUnlock, unlock, onUnlocked };
}
