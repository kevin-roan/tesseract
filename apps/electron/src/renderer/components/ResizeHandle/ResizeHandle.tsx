import { cx } from "../../lib/cx";
import { SIDEBAR_WIDTH } from "./constants";
import { RESIZE_HANDLE_LABELS } from "./labels";
import type { ResizeAxis, WidthBounds } from "./model";
import { useResizeDrag } from "./use-resize-drag";
import styles from "./ResizeHandle.module.css";

export interface ResizeHandleProps {
  width: number;
  onResize(width: number): void;
  onCommit(width: number): void;
  zoom?: number;
  bounds?: WidthBounds;
  defaultWidth?: number;
  axis?: ResizeAxis;
  reverse?: boolean;
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
  axis = "x",
  reverse = false,
  hidden = false,
  label = RESIZE_HANDLE_LABELS.sidebar,
  className,
}: ResizeHandleProps) {
  const drag = useResizeDrag({ width, zoom, bounds, defaultWidth, axis, reverse, onResize, onCommit });
  if (hidden) return null;
  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={width}
      tabIndex={0}
      data-dragging={drag.dragging || undefined}
      data-axis={axis}
      data-reverse={reverse || undefined}
      className={cx(styles.handle, "to-no-drag", className)}
      {...drag.handlers}
    />
  );
}
