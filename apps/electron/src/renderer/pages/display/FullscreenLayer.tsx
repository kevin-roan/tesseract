import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import { Tooltip } from "../../components/Tooltip";
import type { DisplayPageModel } from "../../features/display/hooks/use-display-page";
import { DISPLAY_LABELS } from "../../features/display/labels";
import { fade } from "../../theme/motion";
import { DisplayStage } from "./DisplayStage";
import styles from "./FullscreenLayer.module.css";

export interface FullscreenLayerProps {
  model: DisplayPageModel;
}

export function FullscreenLayer({ model }: FullscreenLayerProps) {
  const { fullscreen } = model;
  if (!fullscreen.fullscreen) return null;
  return createPortal(
    <div className={styles.layer} onPointerMove={(event) => fullscreen.onPointerMove(event.clientY)}>
      <DisplayStage
        className={styles.stage}
        host={model.host}
        attached
        overlay={model.overlay}
        scale={model.scale}
        viewOnly={model.viewOnly}
        onOverlayAction={model.runOverlayAction}
      />
      <AnimatePresence>
        {fullscreen.revealed ? (
          <motion.div key="exit" className={styles.exit} variants={fade} initial="initial" animate="animate" exit="exit">
            <Tooltip label={DISPLAY_LABELS.exitFullscreen} placement="bottom">
              <button type="button" className={styles.exitButton} aria-label={DISPLAY_LABELS.exitFullscreen} onClick={fullscreen.exit}>
                <Icon name="exit-fullscreen" />
              </button>
            </Tooltip>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
