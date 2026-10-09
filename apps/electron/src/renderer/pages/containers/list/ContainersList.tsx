import { useMemo } from "react";
import { ListGroup } from "../../../components/GroupBand";
import { KeyedList } from "../../../components/KeyedList";
import { PageBody } from "../../../components/PageBody";
import { Crossfade } from "../../../components/Presence";
import { RecordRow } from "../../../components/RecordRow";
import { useContainersList } from "../../../features/containers/hooks/use-containers-list";
import { CONTAINERS_LABELS as L } from "../../../features/containers/labels";
import { usePageHeader } from "../../../shell/header-store";
import { HeaderActions } from "../../projects/HeaderActions";
import { containerRow } from "../shared/rows";
import { StateView } from "../shared/StateView";
import styles from "../ContainersPage.module.css";

export interface ContainersListProps {
  onOpen(name: string): void;
  onCreate(): void;
  onSettings(): void;
}

export function ContainersList({ onOpen, onCreate, onSettings }: ContainersListProps) {
  const list = useContainersList({ onCreate, onSettings });
  const { reload } = list;
  const actions = useMemo(
    () => (
      <HeaderActions
        items={[
          { id: "refresh", icon: "refresh", label: L.refresh, onClick: reload },
          { id: "add", icon: "add", label: L.newContainer, onClick: onCreate },
        ]}
      />
    ),
    [reload, onCreate],
  );
  usePageHeader({ title: L.title, actions });
  const handlers = { open: onOpen, start: list.actions.start, stop: list.actions.stop };
  return (
    <Crossfade id={list.state ? `state:${list.state.title}` : "content"} className={styles.state}>
      {list.state ? (
        <StateView state={list.state} onAction={list.onAction} />
      ) : (
        <PageBody label={L.title}>
          <ListGroup icon="server" title={L.list.group} count={list.containers.length} actionLabel={L.newContainer} onAction={onCreate}>
            <KeyedList
              divided
              label={L.list.group}
              items={list.containers}
              getKey={(container) => container.name}
              renderItem={(container) => (
                <RecordRow {...containerRow(container, list.counts.get(container.name) ?? 0, list.pending.has(container.name), handlers)} />
              )}
            />
          </ListGroup>
        </PageBody>
      )}
    </Crossfade>
  );
}
