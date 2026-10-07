import { EmptyState } from "../../components/EmptyState";
import type { EmptyAction } from "../../features/overview/constants";
import type { EmptyModel } from "../../features/overview/model";
import styles from "./Overview.module.css";

export interface OverviewEmptyProps {
  model: EmptyModel;
  onAction: (action: EmptyAction) => void;
}

export function OverviewEmpty({ model, onAction }: OverviewEmptyProps) {
  const { primary, secondary } = model;
  return (
    <div className={styles.empty}>
      <EmptyState
        title={model.title}
        message={model.message}
        icon={model.icon}
        loading={model.loading}
        actionLabel={primary?.label}
        onAction={primary ? () => onAction(primary.action) : undefined}
        secondaryLabel={secondary?.label}
        onSecondary={secondary ? () => onAction(secondary.action) : undefined}
      />
    </div>
  );
}
