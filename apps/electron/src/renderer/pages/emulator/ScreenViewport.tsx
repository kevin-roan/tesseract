import { EmptyState } from "../../components/EmptyState";
import { useScreenInput } from "../../features/emulator/hooks/use-screen-input";
import type { ScreenSessionHandle } from "../../features/emulator/hooks/use-screen-session";
import { EMULATOR_PAGE_LABELS } from "../../features/emulator/labels";
import type { OverlayModel } from "../../features/emulator/types";
import styles from "./ScreenViewport.module.css";

export interface ScreenViewportProps {
  screen: ScreenSessionHandle;
  overlay: OverlayModel | null;
}

export function ScreenViewport({ screen, overlay }: ScreenViewportProps) {
  const input = useScreenInput(screen.session);
  return (
    <div
      ref={input.stageRef}
      className={styles.viewport}
      tabIndex={0}
      role="application"
      aria-label={EMULATOR_PAGE_LABELS.screen}
      title={screen.state.status === "connected" ? EMULATOR_PAGE_LABELS.screenHint : undefined}
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
  );
}
