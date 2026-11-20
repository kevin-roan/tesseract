import type { CSSProperties } from "react";
import { useParams } from "react-router";
import { DEVICE_WINDOW_CHROME, isDeviceWindowKind } from "../../../shared/device-window";
import { EmptyState } from "../../components/EmptyState";
import { IconButton } from "../../components/IconButton";
import { Text } from "../../components/Text";
import { ToastHost } from "../../components/Toast";
import { Glyph, useWindowControls, WINDOW_CONTROLS_LABELS } from "../../components/WindowControls";
import { deviceKind } from "../../features/emulator/devices";
import { useDeviceWindow } from "../../features/emulator/hooks/use-device-window";
import { DEVICE_WINDOW_LABELS, EMULATOR_PAGE_LABELS } from "../../features/emulator/labels";
import { cx } from "../../lib/cx";
import { ScreenViewport } from "../emulator/ScreenViewport";
import { HostUnlock } from "../shell/HostUnlock";
import styles from "./DeviceWindow.module.css";

const chrome = { "--device-toolbar": `${DEVICE_WINDOW_CHROME.toolbar}px`, "--device-bezel": `${DEVICE_WINDOW_CHROME.bezel}px` } as CSSProperties;

export default function DeviceWindow() {
  const { kind } = useParams();
  const device = useDeviceWindow(deviceKind(isDeviceWindowKind(kind) ? kind : null));
  const controls = useWindowControls();
  const { host, view, connected, aspect } = device;
  const { gate } = host;
  return (
    <div className={cx(styles.window, "to-drag")} style={chrome}>
      <header className={styles.toolbar}>
        <div className={cx(styles.lights, "to-no-drag")}>
          <button type="button" className={cx(styles.light, styles.close)} aria-label={WINDOW_CONTROLS_LABELS.close} title={WINDOW_CONTROLS_LABELS.close} onClick={controls.close}>
            <Glyph name="close" />
          </button>
          <button type="button" className={cx(styles.light, styles.minimize)} aria-label={WINDOW_CONTROLS_LABELS.minimize} title={WINDOW_CONTROLS_LABELS.minimize} onClick={controls.minimize}>
            <Glyph name="minimize" />
          </button>
        </div>
        <Text variant="label" lines={1} className={styles.title}>
          {device.title}
        </Text>
        <div className={cx(styles.keys, "to-no-drag")} role="toolbar" aria-label={EMULATOR_PAGE_LABELS.keys}>
          {device.keys.map((key) => (
            <IconButton key={key.id} icon={key.icon} label={key.label} disabled={!connected} onClick={() => view.screen.session.send(key.message)} />
          ))}
          <IconButton icon="screenshot" label={DEVICE_WINDOW_LABELS.screenshot} disabled={!connected} onClick={() => void device.screenshot()} />
        </div>
      </header>
      <div className={cx(styles.screen, "to-no-drag")} style={aspect ? ({ "--device-aspect": aspect } as CSSProperties) : undefined}>
        {gate ? (
          <EmptyState
            icon={gate.icon}
            loading={gate.loading}
            title={gate.title}
            message={gate.message}
            actionLabel={gate.actionLabel ?? undefined}
            onAction={gate.action ? host.onAction : undefined}
          />
        ) : (
          <ScreenViewport screen={view.screen} overlay={view.overlay} />
        )}
      </div>
      <HostUnlock dialog={host.unlockDialog} />
      <ToastHost />
    </div>
  );
}
