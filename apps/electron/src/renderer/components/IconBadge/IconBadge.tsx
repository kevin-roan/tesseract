import type { SemanticColor } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import styles from "./IconBadge.module.css";

export type IconBadgeSize = "md" | "card" | "large";

export interface IconBadgeProps {
  icon: IconName;
  size?: IconBadgeSize;
  color?: SemanticColor;
  label?: string;
  className?: string;
}

export function IconBadge({ icon, size = "md", color, label, className }: IconBadgeProps) {
  return (
    <span className={cx(styles.badge, styles[size], className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Icon name={icon} color={color} />
    </span>
  );
}
