import { EmptyState } from "../../../components/EmptyState";
import type { ListStateAction, ListStateView } from "../../../features/containers/model";
import styles from "../ContainersPage.module.css";

export interface StateViewProps {
  state: ListStateView;
  onAction(action: ListStateAction): void;
}

export function StateView({ state, onAction }: StateViewProps) {
  const { action, secondary } = state;
  return (
    <div className={styles.fill}>
      <EmptyState
        title={state.title}
        message={state.message}
        icon={state.icon}
        loading={state.loading}
        actionLabel={action?.label}
        onAction={action ? () => onAction(action.id) : undefined}
        secondaryLabel={secondary?.label}
        onSecondary={secondary ? () => onAction(secondary.id) : undefined}
      />
    </div>
  );
}
