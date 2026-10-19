import { EmptyState } from "../../components/EmptyState";
import { IconButton } from "../../components/IconButton";
import { StatusBadge } from "../../components/StatusBadge";
import { Text } from "../../components/Text";
import { useScreenInput } from "../../features/emulator/hooks/use-screen-input";
import type { ScreenSessionHandle } from "../../features/emulator/hooks/use-screen-session";
import { EMULATOR_PAGE_LABELS } from "../../features/emulator/labels";
import type { BadgeModel, OverlayModel, ScreenKey } from "../../features/emulator/types";
import styles from "./ScreenStage.module.css";

export interface ScreenStageProps {
  screen: ScreenSessionHandle;
  keys: readonly ScreenKey[];
  overlay: OverlayModel | null;
  badge: BadgeModel;
  title: string;
}

export function ScreenStage({ screen, keys, overlay, badge, title }: ScreenStageProps) {
  const input = useScreenInput(screen.session);
  const connected = screen.state.status === "connected";
  return (
    <div className={styles.stage}>
      <div
        ref={input.stageRef}
        className={styles.viewport}
        tabIndex={0}
        role="application"
        aria-label={EMULATOR_PAGE_LABELS.screen}
        title={connected ? EMULATOR_PAGE_LABELS.screenHint : undefined}
        {...input.stage}
      >
        <canvas ref={screen.canvasRef} className={styles.canvas} data-dimmed={overlay ? true : undefined} {...input.canvas} />
        {overlay ? (
          <div className={styles.overlay} role="status">
            <EmptyState
              icon={null}
              loading={overlay.spinner}
              title={overlay.title}
              message={overlay.message}
              actionLabel={overlay.actionLabel ?? undefined}
              onAction={overlay.actionLabel ? screen.reconnect : undefined}
            />
          </div>
        ) : null}
      </div>
      <div className={styles.side}>
        <div className={styles.status}>
          <Text variant="label" lines={1}>
            {title}
          </Text>
          <StatusBadge label={badge.label} tone={badge.tone} live={badge.tone === "success"} />
        </div>
        <div className={styles.keys} role="toolbar" aria-label={EMULATOR_PAGE_LABELS.keys}>
          {keys.map((key) => (
            <IconButton key={key.id} icon={key.icon} label={key.label} tooltipPlacement="left" disabled={!connected} onClick={() => screen.session.send(key.message)} />
          ))}
        </div>
      </div>
    </div>
  );
}
