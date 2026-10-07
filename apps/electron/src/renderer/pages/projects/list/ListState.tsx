import { EmptyState } from "../../../components/EmptyState";
import type { ListStateAction, ListStateView } from "../../../features/projects/list-view";
import styles from "./ProjectsList.module.css";

export interface ListStateProps {
  state: ListStateView;
  onAction(action: ListStateAction): void;
  className?: string;
}

export function ListState({ state, onAction, className }: ListStateProps) {
  return (
    <div className={styles.fill}>
    <EmptyState
      className={className}
      title={state.title}
      message={state.message}
      icon={state.icon}
      loading={state.loading}
      actionLabel={state.action?.label}
      onAction={state.action ? () => onAction(state.action!.id) : undefined}
      secondaryLabel={state.secondary?.label}
      onSecondary={state.secondary ? () => onAction(state.secondary!.id) : undefined}
    />
    </div>
  );
}
