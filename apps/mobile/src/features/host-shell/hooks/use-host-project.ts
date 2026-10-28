import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@tesseract/client";
import type { ProjectGitAction } from "@tesseract/protocol";

import type { MenuOption } from "@/components/menu-sheet";
import { getSandboxClient } from "@/features/sandbox/api/client";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { describeError } from "@/features/sandbox/utils/errors";

import { hostKeys } from "../api/query-keys";
import { selectHost, selectWorkspaceId, useHostStore } from "../store/host-store";
import { HOST_PROJECT_COPY as COPY } from "../utils/content";
import { folderName, gitSummary } from "../utils/workspace";
import { useHostNavigation } from "./use-host-navigation";
import { useHostWorkspaceSync } from "./use-host-workspace-sync";

export type HostProjectNotice = { tone: "neutral" | "danger"; message: string };

export type HostProjectGit = {
  menuVisible: boolean;
  options: MenuOption[];
  openMenu: () => void;
  closeMenu: () => void;
  select: (id: string) => void;
  commitVisible: boolean;
  closeCommit: () => void;
  message: string;
  setMessage: (message: string) => void;
  commit: () => void;
  pending: ProjectGitAction | null;
};

export type HostProjectState =
  | { kind: "hidden" }
  | { kind: "connect"; connect: () => void }
  | { kind: "missing" }
  | {
      kind: "ready";
      workspaceId: string;
      folder: string;
      path: string;
      claude: () => void;
      shell: () => void;
      git: HostProjectGit;
      notice: HostProjectNotice | null;
      dismissNotice: () => void;
    };

const GIT_OPTIONS: MenuOption[] = [
  { id: "pull", label: COPY.pull, description: COPY.pullHint },
  { id: "push", label: COPY.push, description: COPY.pushHint },
  { id: "commit", label: COPY.commit, description: COPY.commitHint },
];

const isGitAction = (id: string): id is ProjectGitAction => GIT_OPTIONS.some((option) => option.id === id);

/** The sandbox project's copy on the paired host (the host workspace controller), and what the phone can do with it there. */
export function useHostProject(projectId: string, enabled = true): HostProjectState {
  useHostWorkspaceSync();
  const nav = useHostNavigation();
  const sandboxId = useSandboxStore((state) => state.activeId);
  const host = useHostStore((state) => selectHost(state, sandboxId));
  const workspaceId = useHostStore((state) => selectWorkspaceId(state, sandboxId));
  const workspace = useSandboxStore((state) => state.sandboxes.find((entry) => entry.id === workspaceId) ?? null);
  const token = useSandboxStore((state) => (workspaceId ? (state.tokens[workspaceId] ?? null) : null));
  const client = useMemo(() => (workspace && token ? getSandboxClient(workspace, token) : null), [workspace, token]);

  const [menuVisible, setMenuVisible] = useState(false);
  const [commitVisible, setCommitVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<HostProjectNotice | null>(null);

  const project = useQuery({
    queryKey: hostKeys.workspaceProject(workspaceId ?? "", projectId),
    queryFn: ({ signal }) => {
      if (!client) throw new Error("The host workspace is not paired.");
      return client.getProject(projectId, { signal });
    },
    enabled: enabled && client !== null && projectId !== "",
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });

  const git = useMutation({
    mutationFn: ({ action, text }: { action: ProjectGitAction; text?: string }) => {
      if (!client) throw new Error("The host workspace is not paired.");
      return client.runProjectGit(projectId, { action, ...(text ? { message: text } : {}) });
    },
    onSuccess: (result) => {
      if (result.action === "commit") {
        setMessage("");
        setCommitVisible(false);
      }
      setNotice({ tone: "neutral", message: COPY.done[result.action](gitSummary(result.output, COPY.upToDate)) });
    },
    onError: (error, { action }) => setNotice({ tone: "danger", message: COPY.failed[action](describeError(error)) }),
  });
  const { mutate } = git;

  const select = useCallback(
    (id: string) => {
      setMenuVisible(false);
      if (!isGitAction(id)) return;
      if (id === "commit") setCommitVisible(true);
      else mutate({ action: id });
    },
    [mutate],
  );

  const commit = useCallback(() => {
    if (message.trim()) mutate({ action: "commit", text: message.trim() });
  }, [message, mutate]);

  const gitState = useMemo<HostProjectGit>(
    () => ({
      menuVisible,
      options: GIT_OPTIONS,
      openMenu: () => setMenuVisible(true),
      closeMenu: () => setMenuVisible(false),
      select,
      commitVisible,
      closeCommit: () => setCommitVisible(false),
      message,
      setMessage,
      commit,
      pending: git.isPending ? (git.variables?.action ?? null) : null,
    }),
    [menuVisible, select, commitVisible, message, commit, git.isPending, git.variables],
  );

  if (!enabled || !host) return { kind: "hidden" };
  if (!workspaceId || !client) return { kind: "connect", connect: nav.open };
  if (project.error instanceof ApiError && project.error.status === 404) return { kind: "missing" };
  if (!project.data) return { kind: "hidden" };
  const path = project.data.path;
  return {
    kind: "ready",
    workspaceId,
    folder: folderName(path),
    path,
    claude: () => nav.projectChat(projectId, workspaceId),
    shell: () => nav.projectShell(projectId, workspaceId),
    git: gitState,
    notice,
    dismissNotice: () => setNotice(null),
  };
}
