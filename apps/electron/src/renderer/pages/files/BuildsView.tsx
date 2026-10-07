import type { BuildOutput } from "@theone/protocol";
import { EmptyState } from "../../components/EmptyState";
import { GroupedList } from "../../components/GroupedList";
import { BAND_ICON, BUILDS_EMPTY_ICON } from "../../features/files/constants";
import type { FileActions } from "../../features/files/hooks/use-file-actions";
import type { FilesPageModel } from "../../features/files/hooks/use-files-page";
import { OUTPUT_LABELS } from "../../features/files/labels";
import { outputKey } from "../../features/files/model";
import { OutputRow } from "./OutputRow";

export interface BuildsViewProps {
  builds: FilesPageModel["builds"];
  actions: FileActions;
}

export function BuildsView({ builds, actions }: BuildsViewProps) {
  if (builds.status === "loading") return <EmptyState title={OUTPUT_LABELS.loading} loading icon={null} />;
  if (builds.status === "error") return <EmptyState title={OUTPUT_LABELS.errorTitle} message={builds.error} icon={BUILDS_EMPTY_ICON} />;
  if (builds.groups.length === 0) return <EmptyState title={builds.empty.title} message={builds.empty.message} icon={BUILDS_EMPTY_ICON} />;
  return (
    <GroupedList<BuildOutput>
      groups={builds.groups}
      icon={BAND_ICON}
      getKey={outputKey}
      renderItem={(output) => <OutputRow output={output} actions={actions} />}
    />
  );
}
