import type { Artifact } from "@tesseract/protocol";
import { EmptyState } from "../../components/EmptyState";
import { GroupedList } from "../../components/GroupedList";
import { BAND_ICON, SHARED_EMPTY_ICON } from "../../features/files/constants";
import type { FileActions } from "../../features/files/hooks/use-file-actions";
import { artifactKey, type EmptyCopy, type FileGroup } from "../../features/files/model";
import { ArtifactRow } from "./ArtifactRow";

export interface SharedFilesViewProps {
  groups: FileGroup<Artifact>[];
  empty: EmptyCopy;
  actions: FileActions;
}

export function SharedFilesView({ groups, empty, actions }: SharedFilesViewProps) {
  if (groups.length === 0) return <EmptyState title={empty.title} message={empty.message} icon={SHARED_EMPTY_ICON} />;
  return <GroupedList groups={groups} icon={BAND_ICON} getKey={artifactKey} renderItem={(artifact) => <ArtifactRow artifact={artifact} actions={actions} />} />;
}
