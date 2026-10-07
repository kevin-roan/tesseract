import type { LucideIcon } from "lucide-react";
import { ICON_SIZE, ICON_STROKE_WIDTH, ICONS, type IconName, type IconSize } from "../../theme/icons";
import type { SemanticColor } from "../../theme/colors";
import { cx } from "../../lib/cx";
import styles from "./Icon.module.css";

export interface IconProps {
  name?: IconName;
  icon?: LucideIcon;
  size?: IconSize | number;
  color?: SemanticColor;
  className?: string;
  label?: string;
}

export function Icon({ name, icon, size = "md", color, className, label }: IconProps) {
  const Glyph = icon ?? (name ? ICONS[name] : null);
  if (!Glyph) return null;
  const pixels = typeof size === "number" ? size : ICON_SIZE[size];
  return (
    <Glyph
      size={pixels}
      strokeWidth={ICON_STROKE_WIDTH}
      className={cx(styles.icon, className)}
      style={color ? { color: `var(--to-${color})` } : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable={false}
    />
  );
}
