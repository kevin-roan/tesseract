import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { Artifact } from "@tesseract/protocol";

import type { ChoiceOption } from "@/components/choice-group";
import { projectLabel, projectNames } from "@/features/chats/utils/sessions";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useDeleteArtifact, useSendArtifactToTaildrop } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useArtifacts, useProjects, useTaildropTargets } from "@/features/sandbox/hooks/use-sandbox-queries";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";
import { firstParam } from "@/features/sandbox/utils/routes";
import { confirm } from "@/lib/confirm";

import { ALL_PROJECTS, FILE_DOWNLOAD_PARAM, MISSING_FILE_MESSAGE } from "../utils/constants";
import { filesSubtitle, sortTaildropTargets } from "../utils/describe";
import { describeFileError } from "../utils/errors";
import {
  DEFAULT_FILE_FILTERS,
  FILES_VIEWS,
  SOURCE_FILTERS,
  filterFiles,
  isSourceFilter,
  projectFilterId,
  projectFilterOptions,
  type FileFilters,
  type FilesView,
} from "../utils/filters";
import { useBuildOutputs } from "./use-build-outputs";
import { useFileDownload } from "./use-file-download";

const SOURCE_OPTIONS: ChoiceOption[] = SOURCE_FILTERS.map(({ id, label }) => ({ id, label }));

export function useFilesScreen() {
  const nav = useSandboxNavigation();
  const { sandbox, client, hydrated } = useSandboxClient();
  const params = useLocalSearchParams<Record<typeof FILE_DOWNLOAD_PARAM, string>>();
  const artifacts = useArtifacts();
  const projects = useProjects();
  const taildrop = useTaildropTargets();
  const downloads = useFileDownload();
  const deletion = useDeleteArtifact();
  const sending = useSendArtifactToTaildrop();
  const { refreshing, refresh } = useSandboxRefresh();
  const [view, setView] = useState<FilesView>("shared");
  const [filters, setFilters] = useState<FileFilters>(DEFAULT_FILE_FILTERS);
  const [sharing, setSharing] = useState<Artifact | null>(null);
  const requested = firstParam(params[FILE_DOWNLOAD_PARAM]);
  const handled = useRef<string | null>(null);
  const { download, showError } = downloads;
  const { mutate: deleteFile } = deletion;
  const { mutate: sendFile, reset: resetSend } = sending;

  const all = artifacts.data;

  useEffect(() => {
    if (!requested || !client || !all || handled.current === requested) return;
    handled.current = requested;
    const artifact = all.find((item) => item.id === requested);
    if (artifact) download(artifact);
    else showError(MISSING_FILE_MESSAGE);
  }, [requested, client, all, download, showError]);

  const names = useMemo(() => projectNames(projects.data), [projects.data]);
  const builds = useBuildOutputs(view === "builds", names);
  const files = useMemo(() => filterFiles(all ?? [], filters), [all, filters]);
  const projectOptions = useMemo(() => projectFilterOptions(all ?? [], names), [all, names]);
  const targets = useMemo(() => sortTaildropTargets(taildrop.data?.targets ?? []), [taildrop.data]);

  const selectSource = useCallback((id: string) => {
    if (isSourceFilter(id)) setFilters((current) => ({ ...current, source: id }));
  }, []);

  const selectProject = useCallback((id: string) => {
    setFilters((current) => ({ ...current, projectId: projectFilterId(id) }));
  }, []);

  const remove = useCallback(
    async (artifact: Artifact) => {
      const confirmed = await confirm({
        title: `Delete ${artifact.fileName}?`,
        message: "It is removed from the sandbox. Copies already downloaded to your devices are kept.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (confirmed) deleteFile(artifact.id);
    },
    [deleteFile],
  );

  const openTaildrop = useCallback(
    (artifact: Artifact) => {
      resetSend();
      setSharing(artifact);
      void taildrop.refetch();
    },
    [resetSend, taildrop],
  );

  const sendTo = useCallback(
    (targetId: string) => {
      if (!sharing) return;
      sendFile({ artifactId: sharing.id, targetId }, { onSuccess: () => setSharing(null) });
    },
    [sharing, sendFile],
  );

  const sentTo = sending.isSuccess ? targets.find((target) => target.id === sending.variables.targetId) : undefined;
  const actionError = deletion.error ?? (sharing ? null : sending.error);

  return {
    hydrated,
    paired: sandbox !== null,
    back: () => (router.canGoBack() ? router.back() : router.replace("/projects")),
    pair: nav.pair,
    files,
    total: all?.length ?? 0,
    subtitle: view === "builds" ? builds.subtitle : filesSubtitle(files.length, all?.length ?? 0),
    viewOptions: FILES_VIEWS,
    view,
    selectView: setView,
    builds,
    projectName: (projectId: string) => projectLabel(projectId, names),
    loading: artifacts.isLoading,
    error: artifacts.error ? describeError(artifacts.error) : null,
    retry: () => void artifacts.refetch(),
    filtered: filters.projectId !== null || filters.source !== "all",
    clearFilters: () => setFilters(DEFAULT_FILE_FILTERS),
    sourceOptions: SOURCE_OPTIONS,
    sourceId: filters.source,
    selectSource,
    projectOptions,
    projectId: filters.projectId ?? ALL_PROJECTS,
    selectProject,
    download,
    share: downloads.share,
    localStatus: downloads.status,
    downloadError: downloads.error,
    remove: (artifact: Artifact) => void remove(artifact),
    deletingId: deletion.isPending ? deletion.variables : null,
    taildropAvailable: taildrop.data?.available === true,
    openTaildrop,
    sendTo,
    sharing,
    closeTaildrop: () => setSharing(null),
    targets,
    targetsLoading: taildrop.isFetching && !taildrop.data,
    sendingTargetId: sending.isPending ? sending.variables.targetId : null,
    sendError: sharing && sending.error ? describeFileError(sending.error) : null,
    sentMessage: sentTo && sending.data ? `Sent ${sending.data.fileName} to ${sentTo.hostName}` : null,
    actionError: actionError ? describeFileError(actionError) : null,
    refreshing,
    refresh,
  };
}
