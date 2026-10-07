import { cx } from "../../lib/cx";
import { SIDEBAR_WIDTH } from "./constants";
import { RESIZE_HANDLE_LABELS } from "./labels";
import type { WidthBounds } from "./model";
import { useResizeDrag } from "./use-resize-drag";
import styles from "./ResizeHandle.module.css";

export interface ResizeHandleProps {
  width: number;
  onResize(width: number): void;
  onCommit(width: number): void;
  zoom?: number;
  bounds?: WidthBounds;
  defaultWidth?: number;
  hidden?: boolean;
  label?: string;
  className?: string;
}

export function ResizeHandle({
  width,
  onResize,
  onCommit,
  zoom = 1,
  bounds = SIDEBAR_WIDTH,
  defaultWidth = SIDEBAR_WIDTH.default,
  hidden = false,
  label = RESIZE_HANDLE_LABELS.sidebar,
  className,
}: ResizeHandleProps) {
  const drag = useResizeDrag({ width, zoom, bounds, defaultWidth, onResize, onCommit });
  if (hidden) return null;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={width}
      tabIndex={0}
      data-dragging={drag.dragging || undefined}
      className={cx(styles.handle, "to-no-drag", className)}
      {...drag.handlers}
    />
  );
}
