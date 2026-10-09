import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import type { ProjectFile } from "@tesseract/protocol";

import { useSendProjectFileToTaildrop } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useProject, useProjectFiles, useTaildropTargets } from "@/features/sandbox/hooks/use-sandbox-queries";
import { describeError } from "@/features/sandbox/utils/errors";

import { sortTaildropTargets } from "../utils/describe";
import { describeFileError } from "../utils/errors";
import { breadcrumbs, directorySubtitle, parentPath, PROJECT_FILES_COPY } from "../utils/project-files";
import { useProjectFileDownload } from "./use-file-download";

/** Browses a project's folders and saves, shares or Taildrops its files. */
export function useProjectFilesScreen(projectId: string, initialPath = "") {
  const [path, setPath] = useState(initialPath);
  const project = useProject(projectId);
  const listing = useProjectFiles(projectId, path);
  const taildrop = useTaildropTargets();
  const downloads = useProjectFileDownload(projectId);
  const sending = useSendProjectFileToTaildrop();
  const [sharing, setSharing] = useState<ProjectFile | null>(null);
  const { mutate: sendFile, reset: resetSend } = sending;

  const targets = useMemo(() => sortTaildropTargets(taildrop.data?.targets ?? []), [taildrop.data]);
  const rootLabel = project.data?.name ?? projectId;
  const crumbs = useMemo(() => breadcrumbs(path, rootLabel), [path, rootLabel]);
  const parent = parentPath(path);

  const openTaildrop = useCallback(
    (file: ProjectFile) => {
      resetSend();
      setSharing(file);
      void taildrop.refetch();
    },
    [resetSend, taildrop],
  );

  const sendTo = useCallback(
    (targetId: string) => {
      if (!sharing) return;
      sendFile({ projectId, path: sharing.path, targetId }, { onSuccess: () => setSharing(null) });
    },
    [projectId, sharing, sendFile],
  );

  const sentTo = sending.isSuccess ? targets.find((target) => target.id === sending.variables.targetId) : undefined;

  return {
    title: path ? (crumbs[crumbs.length - 1]?.label ?? PROJECT_FILES_COPY.title) : PROJECT_FILES_COPY.title,
    subtitle: rootLabel,
    summary: directorySubtitle(listing.data) ?? PROJECT_FILES_COPY.title,
    back: () => {
      if (parent !== null) setPath(parent);
      else if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/sandbox/projects/[id]", params: { id: projectId } });
    },
    path,
    open: setPath,
    crumbs,
    entries: listing.data?.entries ?? [],
    truncated: listing.data?.truncated ?? false,
    loading: listing.isLoading,
    error: listing.error ? describeError(listing.error) : null,
    retry: () => void listing.refetch(),
    refreshing: listing.isRefetching,
    refresh: () => void listing.refetch(),
    download: downloads.download,
    share: downloads.share,
    localStatus: downloads.status,
    downloadError: downloads.error,
    taildropAvailable: taildrop.data?.available === true,
    openTaildrop,
    sendTo,
    sharing,
    closeTaildrop: () => setSharing(null),
    targets,
    targetsLoading: taildrop.isFetching && !taildrop.data,
    sendingTargetId: sending.isPending ? sending.variables.targetId : null,
    sendError: sharing && sending.error ? describeFileError(sending.error) : null,
    sendFailure: !sharing && sending.error ? describeFileError(sending.error) : null,
    sentMessage: sentTo && sending.data ? `Sent ${sending.data.name} to ${sentTo.hostName}` : null,
  };
}
