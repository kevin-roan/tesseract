import { cx } from "../../lib/cx";
import { Crossfade, Presence } from "../Presence";
import { countLabel } from "./model";
import styles from "./Sidebar.module.css";

export interface SidebarCountProps {
  count?: number | null;
  max?: number;
  title?: string;
  className?: string;
}

export function SidebarCount({ count, max, title, className }: SidebarCountProps) {
  const label = countLabel(count, max);
  return (
    <Presence show={label !== null} as="span" className={cx(styles.count, className)}>
      <span title={title} className={styles.countValue}>
        <Crossfade id={label ?? ""} speed="fast" inline>
          {label}
        </Crossfade>
      </span>
    </Presence>
  );
}
