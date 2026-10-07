import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { WindowControls } from "../WindowControls";
import styles from "./Titlebar.module.css";
import { useTitlebarControls } from "./use-titlebar-controls";

export type TitlebarVariant = "page" | "sidebar";

export interface TitlebarProps {
  start?: ReactNode;
  end?: ReactNode;
  controls?: boolean | ReactNode;
  divider?: boolean;
  variant?: TitlebarVariant;
  trafficLightInset?: boolean;
  backdrop?: boolean;
  className?: string;
}

export function Titlebar({
  start,
  end,
  controls = true,
  divider = false,
  variant = "page",
  trafficLightInset = variant === "sidebar",
  backdrop = false,
  className,
}: TitlebarProps) {
  const shown = useTitlebarControls(controls);
  const controlsNode = shown === null ? null : shown.kind === "native" ? <WindowControls /> : shown.node;
  const hasEnd = end !== undefined && end !== null && end !== false;
  return (
    <header
      className={cx(
        styles.titlebar,
        styles[variant],
        divider && styles.divided,
        trafficLightInset && styles.inset,
        "to-drag",
        className,
      )}
      data-variant={variant}
      data-backdrop={backdrop || undefined}
    >
      <div className={styles.start}>{start}</div>
      <div className={styles.end}>
        {hasEnd ? <div className={styles.group}>{end}</div> : null}
        {hasEnd && controlsNode ? <span className={styles.separator} aria-hidden /> : null}
        {controlsNode}
      </div>
    </header>
  );
}
