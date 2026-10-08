import type { DisplayWindow } from "@tesseract/protocol";
import { EmptyState } from "../../components/EmptyState";
import { IconButton } from "../../components/IconButton";
import { RecordRow, type RowAction } from "../../components/RecordRow";
import type { DisplayWindowsHandle } from "../../features/display/hooks/use-display-windows";
import { WINDOWS_LABELS } from "../../features/display/labels";
import { windowState, windowTitle } from "../../features/display/model";
import styles from "./WindowsPopover.module.css";
import { Swap } from "./Swap";

export interface WindowsPopoverProps {
  handle: DisplayWindowsHandle;
  onActivate(window: DisplayWindow): void;
  onForceQuit(window: DisplayWindow): void;
}

function WindowsState({ handle }: { handle: DisplayWindowsHandle }) {
  if (handle.error) {
    return (
      <EmptyState
        className={styles.state}
        icon="warning"
        title={WINDOWS_LABELS.errorTitle}
        message={handle.error}
        actionLabel={WINDOWS_LABELS.refresh}
        onAction={handle.refresh}
      />
    );
  }
  if (handle.windows === null) return <EmptyState className={styles.state} loading title={WINDOWS_LABELS.loading} />;
  return <EmptyState className={styles.state} icon="app-window" title={WINDOWS_LABELS.emptyTitle} message={WINDOWS_LABELS.emptyMessage} />;
}

export function WindowsPopover({ handle, onActivate, onForceQuit }: WindowsPopoverProps) {
  const list = handle.windows ?? [];
  const showList = !handle.error && list.length > 0;
  const actionsFor = (window: DisplayWindow): RowAction[] => [
    {
      id: "close",
      icon: "close",
      label: WINDOWS_LABELS.close,
      sensitive: !handle.busy,
      onActivate: () => void handle.close(window.id),
    },
    {
      id: "force",
      icon: "failed",
      label: WINDOWS_LABELS.forceQuit,
      destructive: true,
      sensitive: !handle.busy,
      onActivate: () => onForceQuit(window),
    },
  ];
  return (
    <div className={styles.popover}>
      <div className={styles.header}>
        <span className={styles.title}>{WINDOWS_LABELS.title}</span>
        <IconButton icon="refresh" label={WINDOWS_LABELS.refresh} onClick={handle.refresh} />
      </div>
      <Swap id={showList ? "list" : "state"} className={styles.content}>
        {showList ? (
          <div className={styles.list} aria-busy={handle.busy || undefined}>
            {list.map((window) => (
              <RecordRow
                key={window.id}
                className={styles.row}
                icon="app-window"
                iconColor={window.active ? "accent" : "text-secondary"}
                title={windowTitle(window)}
                subtitle={window.app}
                meta={windowState(window)}
                actions={actionsFor(window)}
                onActivate={handle.busy ? undefined : () => onActivate(window)}
              />
            ))}
          </div>
        ) : (
          <WindowsState handle={handle} />
        )}
      </Swap>
    </div>
  );
}
