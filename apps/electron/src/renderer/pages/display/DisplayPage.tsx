import { useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { COMPACT_MAX_WIDTH } from "../../features/display/constants";
import { useDisplayKeys } from "../../features/display/hooks/use-display-keys";
import { useDisplayPage } from "../../features/display/hooks/use-display-page";
import { useElementSize } from "../../features/display/hooks/use-element-size";
import { DisplayStage } from "./DisplayStage";
import { DisplayToolbar } from "./DisplayToolbar";
import { FullscreenLayer } from "./FullscreenLayer";
import { ScreenshotPreview } from "./ScreenshotPreview";
import { viewFor } from "./view";
import styles from "./DisplayPage.module.css";
import { Swap } from "./Swap";

export default function DisplayPage() {
  const model = useDisplayPage();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const width = useElementSize(root).width;
  const compact = width > 0 && width <= COMPACT_MAX_WIDTH;
  const view = viewFor(model.mode);

  useDisplayKeys({
    root,
    fullscreen: model.fullscreen.fullscreen,
    canvasTakesEscape: model.canvasTakesEscape,
    onToggleFullscreen: model.fullscreen.toggle,
    onExitFullscreen: model.fullscreen.exit,
  });

  return (
    <div ref={setRoot} className={styles.page}>
      <DisplayToolbar model={model} compact={compact} />
      <Swap id={view} className={styles.body} layerClassName={styles.layer}>
        {view === "viewer" ? (
          <div className={styles.holder}>
            <DisplayStage
              host={model.host}
              attached={!model.fullscreen.fullscreen}
              overlay={model.overlay}
              scale={model.scale}
              viewOnly={model.viewOnly}
              onOverlayAction={model.runOverlayAction}
            />
          </div>
        ) : view === "preview" ? (
          <ScreenshotPreview picture={model.picture} onCheckAgain={model.checkAgain} />
        ) : (
          <EmptyState
            icon={model.empty.icon}
            loading={model.empty.loading}
            title={model.empty.title}
            message={model.empty.message || null}
            actionLabel={model.empty.action ?? undefined}
            onAction={model.empty.action ? model.checkAgain : undefined}
          />
        )}
      </Swap>
      <FullscreenLayer model={model} />
    </div>
  );
}
