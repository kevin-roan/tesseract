import type { Artifact } from "@theone/protocol";
import { EmptyState } from "../../../../components/EmptyState";
import { ListGroup } from "../../../../components/GroupBand";
import { KeyedList } from "../../../../components/KeyedList";
import { CrossfadeStack } from "../../../../components/Section";
import { Spinner } from "../../../../components/Spinner";
import type { TabHost } from "../../../../features/projects/hooks/use-tab-host";
import { ArtifactRow } from "../../../files/ArtifactRow";
import { FilesDialogs } from "../../../files/FilesDialogs";
import { EMPTY_ICON, LIST_ICON } from "./constants";
import { useArtifactsTab } from "./hooks/use-artifacts-tab";
import { ARTIFACTS_LABELS as L } from "./labels";
import { artifactsView } from "./model";
import styles from "./ArtifactsTab.module.css";

export interface ArtifactsTabProps {
  artifacts: readonly Artifact[] | null;
  host: TabHost;
}

export function ArtifactsTab({ artifacts, host }: ArtifactsTabProps) {
  const tab = useArtifactsTab({ artifacts, host });
  const view = artifactsView(tab.artifacts);
  return (
    <>
      <CrossfadeStack view={view}>
        {view === "loading" ? (
          <div className={styles.loading}>
            <Spinner size={24} label={L.loading} />
          </div>
        ) : view === "empty" ? (
          <EmptyState icon={EMPTY_ICON} title={L.emptyTitle} message={L.emptyMessage} />
        ) : (
          <ListGroup icon={LIST_ICON} title={L.list} count={tab.artifacts?.length ?? 0}>
            <KeyedList
              divided
              label={L.list}
              items={tab.artifacts ?? []}
              getKey={(artifact) => artifact.id}
              renderItem={(artifact) => <ArtifactRow artifact={artifact} actions={tab.actions} />}
            />
          </ListGroup>
        )}
      </CrossfadeStack>
      <FilesDialogs actions={tab.actions} />
    </>
  );
}
