import { AnimatePresence, motion } from "motion/react";
import { EmptyState } from "../../components/EmptyState";
import { useInstantSwaps } from "../../features/display/hooks/use-instant-swaps";
import type { OverlayModel } from "../../features/display/model";
import { popover } from "../../theme/motion";
import styles from "./DisplayStage.module.css";

export interface StatusOverlayCardProps {
  overlay: OverlayModel | null;
  onAction(): void;
}

function OverlayContent({ overlay, onAction }: { overlay: OverlayModel; onAction(): void }) {
  return (
    <EmptyState
      className={styles.overlayContent}
      icon={null}
      loading={overlay.spinner}
      title={overlay.title}
      message={overlay.message || null}
      actionLabel={overlay.actionLabel ?? undefined}
      onAction={overlay.actionLabel ? onAction : undefined}
    />
  );
}

export function StatusOverlayCard({ overlay, onAction }: StatusOverlayCardProps) {
  const instant = useInstantSwaps();
  if (instant) {
    return (
      <div className={styles.overlayLayer}>
        {overlay ? (
          <div className={styles.overlay} role="status">
            <OverlayContent overlay={overlay} onAction={onAction} />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className={styles.overlayLayer}>
      <AnimatePresence>
        {overlay ? (
          <motion.div key="overlay" className={styles.overlay} variants={popover} initial="initial" animate="animate" exit="exit" role="status">
            <OverlayContent overlay={overlay} onAction={onAction} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
