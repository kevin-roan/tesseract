import type { DisplayWindow } from "@theone/protocol";
import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { IconButton } from "../../components/IconButton";
import { StatusBadge } from "../../components/StatusBadge";
import type { DisplayPageModel } from "../../features/display/hooks/use-display-page";
import { DISPLAY_LABELS, WINDOWS_LABELS } from "../../features/display/labels";
import { MenuButton } from "./MenuButton";
import { ScaleToggle } from "./ScaleToggle";
import { KeysMenu, OverflowMenu } from "./ToolbarMenus";
import { WindowsPopover } from "./WindowsPopover";
import styles from "./DisplayToolbar.module.css";
import popoverStyles from "./WindowsPopover.module.css";

export interface DisplayToolbarProps {
  model: DisplayPageModel;
  compact: boolean;
}

export function DisplayToolbar({ model, compact }: DisplayToolbarProps) {
  const [forceQuit, setForceQuit] = useState<DisplayWindow | null>(null);
  const can = (action: Parameters<typeof model.enabled.has>[0]) => model.enabled.has(action);

  const activate = async (window: DisplayWindow) => {
    if (await model.windows.activate(window.id)) {
      model.setWindowsOpen(false);
      requestAnimationFrame(() => model.vnc.focus());
    }
  };

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={DISPLAY_LABELS.toolbarLabel}>
      <div className={styles.info}>
        <StatusBadge label={model.badge.label} tone={model.badge.tone} />
        {model.meta ? <span className={styles.meta}>{model.meta}</span> : null}
      </div>
      <div className={styles.actions}>
        <ScaleToggle fit={model.fit} disabled={!can("scale")} onChange={model.setFit} />
        <MenuButton
          icon="app-window"
          label={DISPLAY_LABELS.windows}
          role="dialog"
          disabled={!can("windows")}
          open={model.windowsOpen}
          onOpenChange={model.setWindowsOpen}
          panelClassName={popoverStyles.panel}
        >
          <WindowsPopover
            handle={model.windows}
            onActivate={(window) => void activate(window)}
            onForceQuit={(window) => {
              model.setWindowsOpen(false);
              setForceQuit(window);
            }}
          />
        </MenuButton>
        {compact ? null : (
          <>
            <IconButton
              icon="view-only"
              label={DISPLAY_LABELS.viewOnly}
              checked={model.viewOnly}
              disabled={!can("view_only")}
              onClick={() => model.setViewOnly(!model.viewOnly)}
            />
            <IconButton
              icon="paste"
              label={DISPLAY_LABELS.clipboard}
              checked={model.clipboardSync}
              disabled={!can("clipboard")}
              onClick={() => model.setClipboardSync(!model.clipboardSync)}
            />
            <KeysMenu disabled={!can("keys")} onSend={model.sendKeys} />
            <span className={styles.separator} role="separator" aria-orientation="vertical" />
            <IconButton icon="screenshot" label={DISPLAY_LABELS.screenshot} disabled={!can("screenshot")} onClick={model.saveScreenshot} />
            <IconButton icon="browser" label={DISPLAY_LABELS.browser} disabled={!can("browser")} onClick={model.openInBrowser} />
          </>
        )}
        <IconButton icon="refresh" label={DISPLAY_LABELS.reconnect} disabled={!can("reconnect")} onClick={model.reconnect} />
        <IconButton icon="fullscreen" label={DISPLAY_LABELS.fullscreen} disabled={!can("fullscreen")} onClick={model.fullscreen.enter} />
        {compact ? (
          <OverflowMenu
            viewOnly={model.viewOnly}
            clipboardSync={model.clipboardSync}
            enabled={{
              viewOnly: can("view_only"),
              clipboard: can("clipboard"),
              keys: can("keys"),
              screenshot: can("screenshot"),
              browser: can("browser"),
            }}
            onViewOnly={model.setViewOnly}
            onClipboardSync={model.setClipboardSync}
            onSendKeys={model.sendKeys}
            onScreenshot={model.saveScreenshot}
            onBrowser={model.openInBrowser}
          />
        ) : null}
      </div>
      <ConfirmDialog
        open={forceQuit !== null}
        heading={WINDOWS_LABELS.confirmHeading}
        body={WINDOWS_LABELS.confirmBody}
        cancelLabel={WINDOWS_LABELS.confirmCancel}
        confirmLabel={WINDOWS_LABELS.confirmAction}
        onClose={() => setForceQuit(null)}
        onConfirm={() => {
          if (forceQuit) void model.windows.close(forceQuit.id, true);
        }}
      />
    </div>
  );
}
