import { Notice } from "../../components/Notice";
import { Spinner } from "../../components/Spinner";
import { DISPLAY_LABELS, PREVIEW_LABELS } from "../../features/display/labels";
import { PREVIEW_SPINNER_SIZE } from "./config";
import styles from "./ScreenshotPreview.module.css";
import stageStyles from "./DisplayStage.module.css";
import { Swap } from "./Swap";

export interface ScreenshotPreviewProps {
  picture: string | null;
  onCheckAgain(): void;
}

export function ScreenshotPreview({ picture, onCheckAgain }: ScreenshotPreviewProps) {
  return (
    <div className={styles.preview}>
      <Notice
        className={styles.notice}
        tone="warning"
        icon="display"
        title={PREVIEW_LABELS.title}
        message={PREVIEW_LABELS.message}
        actionLabel={PREVIEW_LABELS.action}
        onAction={onCheckAgain}
      />
      <div className={stageStyles.stage} tabIndex={-1}>
        <Swap id={picture ? "picture" : "loading"} className={styles.frame}>
          {picture ? (
            <img className={styles.picture} src={picture} alt={DISPLAY_LABELS.remoteFrame} draggable={false} />
          ) : (
            <div className={styles.loading}>
              <Spinner size={PREVIEW_SPINNER_SIZE} className={styles.spinner} />
              <span className={styles.caption}>{PREVIEW_LABELS.loading}</span>
            </div>
          )}
        </Swap>
      </div>
    </div>
  );
}
