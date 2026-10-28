import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { Spinner } from "../Spinner";
import { ToneDot } from "../ToneDot";
import { SIDEBAR } from "./constants";
import { SIDEBAR_LABELS } from "./labels";
import { countLabel, type SidebarContainerActivity } from "./model";
import { SidebarItemRow } from "./SidebarItemRow";
import styles from "./Sidebar.module.css";

export interface SidebarContainerRowProps {
  name: string;
  activity: SidebarContainerActivity;
  status: string;
  attention?: number;
  attentionLabel?: string;
  selected?: boolean;
  onOpen?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  className?: string;
}

function ContainerIndicator({ activity, status }: Pick<SidebarContainerRowProps, "activity" | "status">) {
  switch (activity) {
    case "busy":
      return <Spinner size={SIDEBAR.projectIndicatorSpinner} className={styles.activitySpinner} label={status} />;
    case "error":
      return <Icon name="warning" className={styles.activityError} label={status} />;
    case "stopped":
      return <Icon name="server" className={styles.activityMuted} label={status} />;
    case "requested":
      return <Icon name="add" className={styles.activityMuted} label={status} />;
    default:
      return <Icon name="server" label={status} />;
  }
}

function AttentionBadge({ count, label }: { count: number; label?: string }) {
  const text = countLabel(count);
  if (!text) return null;
  return (
    <span className={styles.attention} title={label}>
      {text}
    </span>
  );
}

export function SidebarContainerRow({
  name,
  activity,
  status,
  attention = 0,
  attentionLabel,
  selected = false,
  onOpen,
  onStart,
  onStop,
  className,
}: SidebarContainerRowProps) {
  const toggle =
    activity === "running" && onStop
      ? { icon: "stop" as const, label: SIDEBAR_LABELS.stopContainer(name), onClick: onStop }
      : (activity === "stopped" || activity === "error") && onStart
        ? { icon: "play" as const, label: SIDEBAR_LABELS.startContainer(name), onClick: onStart }
        : null;
  return (
    <SidebarItemRow
      name={name}
      title={SIDEBAR_LABELS.containerTooltip(name, status, attention > 0 ? attentionLabel : undefined)}
      label={SIDEBAR_LABELS.openContainer(name)}
      selected={selected}
      onActivate={onOpen}
      className={className}
      indicator={<ContainerIndicator activity={activity} status={status} />}
      badges={<AttentionBadge count={attention} label={attentionLabel} />}
      trailing={activity === "running" ? <ToneDot tone="success" size={SIDEBAR.containerDotSize} /> : null}
      actions={
        toggle ? <IconButton icon={toggle.icon} label={toggle.label} size={SIDEBAR.rowActionSize} className={styles.rowAction} onClick={toggle.onClick} /> : null
      }
    />
  );
}
