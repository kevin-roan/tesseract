import type { RefObject } from "react";
import { cx } from "../../lib/cx";
import { useOverlayScrollbar } from "./use-overlay-scrollbar";
import styles from "./OverlayScrollbar.module.css";

export interface OverlayScrollbarProps {
  target: RefObject<HTMLElement | null>;
  className?: string;
}

export function OverlayScrollbar({ target, className }: OverlayScrollbarProps) {
  const scrollbar = useOverlayScrollbar(target);
  const { box } = scrollbar;
  if (!box) return null;
  return (
    <div
      className={cx(styles.rail, className)}
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      aria-hidden="true"
      data-overlay-scrollbar=""
    >
      <div
        ref={scrollbar.thumbRef}
        className={styles.thumb}
        style={{ height: box.thumb }}
        data-visible={scrollbar.visible || undefined}
        data-dragging={scrollbar.dragging || undefined}
        {...scrollbar.thumbProps}
      />
    </div>
  );
}
