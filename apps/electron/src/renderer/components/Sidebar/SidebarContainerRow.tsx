import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { Spinner } from "../Spinner";
import { ToneDot } from "../ToneDot";
import { SIDEBAR } from "./constants";
import { SIDEBAR_LABELS } from "./labels";
import type { SidebarContainerActivity } from "./model";
import { SidebarItemRow } from "./SidebarItemRow";
import styles from "./Sidebar.module.css";

export interface SidebarContainerRowProps {
  name: string;
  activity: SidebarContainerActivity;
  status: string;
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
    default:
      return <Icon name="server" label={status} />;
  }
}

export function SidebarContainerRow({ name, activity, status, selected = false, onOpen, onStart, onStop, className }: SidebarContainerRowProps) {
  const toggle =
    activity === "running" && onStop
      ? { icon: "stop" as const, label: SIDEBAR_LABELS.stopContainer(name), onClick: onStop }
      : (activity === "stopped" || activity === "error") && onStart
        ? { icon: "play" as const, label: SIDEBAR_LABELS.startContainer(name), onClick: onStart }
        : null;
  return (
    <SidebarItemRow
      name={name}
      title={SIDEBAR_LABELS.containerTooltip(name, status)}
      label={SIDEBAR_LABELS.openContainer(name)}
      selected={selected}
      onActivate={onOpen}
      className={className}
      indicator={<ContainerIndicator activity={activity} status={status} />}
      trailing={activity === "running" ? <ToneDot tone="success" size={SIDEBAR.containerDotSize} /> : null}
      actions={
        toggle ? <IconButton icon={toggle.icon} label={toggle.label} size={SIDEBAR.rowActionSize} className={styles.rowAction} onClick={toggle.onClick} /> : null
      }
    />
  );
}
