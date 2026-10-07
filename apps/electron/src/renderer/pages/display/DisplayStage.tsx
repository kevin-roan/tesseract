import { cx } from "../../lib/cx";
import { DISPLAY_LABELS } from "../../features/display/labels";
import type { OverlayModel } from "../../features/display/model";
import { isUnitScale } from "../../features/display/model";
import { HostSlot } from "./HostSlot";
import { StatusOverlayCard } from "./StatusOverlayCard";
import styles from "./DisplayStage.module.css";

export interface DisplayStageProps {
  host: HTMLElement;
  attached: boolean;
  overlay: OverlayModel | null;
  scale: number | null;
  viewOnly: boolean;
  onOverlayAction(): void;
  className?: string;
}

export function DisplayStage({ host, attached, overlay, scale, viewOnly, onOverlayAction, className }: DisplayStageProps) {
  return (
    <div
      className={cx(styles.stage, overlay && styles.dimmed, scale !== null && isUnitScale(scale) && styles.unit, viewOnly && styles.viewOnly, className)}
      aria-label={DISPLAY_LABELS.stageLabel}
      role="region"
    >
      {attached ? <HostSlot host={host} /> : null}
      <StatusOverlayCard overlay={overlay} onAction={onOverlayAction} />
    </div>
  );
}
