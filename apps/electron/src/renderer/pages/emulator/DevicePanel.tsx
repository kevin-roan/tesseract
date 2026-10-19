import { Notice } from "../../components/Notice";
import { useDeviceView } from "../../features/emulator/hooks/use-device-view";
import type { DeviceKind } from "../../features/emulator/types";
import { DeviceToolbar } from "./DeviceToolbar";
import { ScreenStage } from "./ScreenStage";
import styles from "./DevicePanel.module.css";

export interface DevicePanelProps {
  kind: DeviceKind;
}

export function DevicePanel({ kind }: DevicePanelProps) {
  const view = useDeviceView(kind);
  return (
    <div className={styles.panel}>
      <DeviceToolbar view={view} />
      {view.controls.error ? <Notice tone="danger" message={view.controls.error} className={styles.notice} /> : null}
      <ScreenStage
        screen={view.screen}
        keys={kind.screen.keys}
        overlay={view.overlay}
        badge={view.screenBadge}
        title={view.screen.state.title ?? view.snapshot?.target ?? kind.label}
      />
    </div>
  );
}
