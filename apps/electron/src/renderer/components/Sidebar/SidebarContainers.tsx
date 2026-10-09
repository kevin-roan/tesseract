import { AnimatedList, AnimatedListItem } from "../AnimatedList";
import { Crossfade } from "../Presence";
import type { SidebarContainerItem, SidebarContainersState } from "./model";
import { SidebarContainerRow } from "./SidebarContainerRow";
import { SidebarStatus } from "./SidebarStatus";
import styles from "./Sidebar.module.css";

export interface SidebarContainersLabels {
  loading: string;
  unavailable: string;
  setUp: string;
  empty: string;
  create: string;
}

export interface SidebarContainersProps {
  state: SidebarContainersState;
  items: readonly SidebarContainerItem[];
  labels: SidebarContainersLabels;
  selected?: string | null;
  onOpen?: (name: string) => void;
  onStart?: (name: string) => void;
  onStop?: (name: string) => void;
  onCreate?: () => void;
  onSetUp?: () => void;
}

export function SidebarContainers({ state, items, labels, selected = null, onOpen, onStart, onStop, onCreate, onSetUp }: SidebarContainersProps) {
  return (
    <Crossfade id={state} speed="fast">
      {state === "loading" ? <SidebarStatus loading message={labels.loading} /> : null}
      {state === "unavailable" ? <SidebarStatus message={labels.unavailable} actionLabel={labels.setUp} onAction={onSetUp} /> : null}
      {state === "empty" ? <SidebarStatus message={labels.empty} actionLabel={labels.create} onAction={onCreate} /> : null}
      {state === "ready" ? (
        <AnimatedList gap={1} className={styles.projectList}>
          {items.map((item) => (
            <AnimatedListItem key={item.name}>
              <SidebarContainerRow
                name={item.name}
                activity={item.activity}
                status={item.status}
                selected={item.name === selected}
                onOpen={onOpen ? () => onOpen(item.name) : undefined}
                onStart={onStart ? () => onStart(item.name) : undefined}
                onStop={onStop ? () => onStop(item.name) : undefined}
              />
            </AnimatedListItem>
          ))}
        </AnimatedList>
      ) : null}
    </Crossfade>
  );
}
