import { IconButton } from "../../components/IconButton";
import { StatusBadge } from "../../components/StatusBadge";
import { Text } from "../../components/Text";
import type { ScreenSessionHandle } from "../../features/emulator/hooks/use-screen-session";
import { EMULATOR_PAGE_LABELS } from "../../features/emulator/labels";
import type { BadgeModel, OverlayModel, ScreenKey } from "../../features/emulator/types";
import { ScreenViewport } from "./ScreenViewport";
import styles from "./ScreenStage.module.css";

export interface ScreenStageProps {
  screen: ScreenSessionHandle;
  keys: readonly ScreenKey[];
  overlay: OverlayModel | null;
  badge: BadgeModel;
  title: string;
}

export function ScreenStage({ screen, keys, overlay, badge, title }: ScreenStageProps) {
  const connected = screen.state.status === "connected";
  return (
    <div className={styles.stage}>
      <ScreenViewport screen={screen} overlay={overlay} />
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
