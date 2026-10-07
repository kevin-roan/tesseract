import { Spinner } from "../Spinner";
import { Text } from "../Text";
import { SIDEBAR } from "./constants";
import styles from "./Sidebar.module.css";

export interface SidebarStatusProps {
  message: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function SidebarStatus({ message, loading = false, actionLabel, onAction }: SidebarStatusProps) {
  return (
    <div className={styles.statusBlock}>
      <div className={styles.status} role={loading ? "status" : undefined}>
        {loading ? <Spinner size={14} className={styles.statusSpinner} /> : null}
        <Text variant="caption" color="text-tertiary" wrap lines={SIDEBAR.statusLines}>
          {message}
        </Text>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className={styles.linkButton} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
