import type { CSSProperties, ElementType, ReactNode } from "react";
import { cx } from "../../lib/cx";
import { cssVar, type SemanticColor } from "../../theme/colors";
import typography from "../../theme/typography.module.css";
import styles from "./Text.module.css";
import type { TextVariant } from "./variants";

export interface TextProps {
  children?: ReactNode;
  variant?: TextVariant;
  color?: SemanticColor;
  lines?: number | null;
  wrap?: boolean;
  center?: boolean;
  selectable?: boolean;
  tabular?: boolean;
  as?: ElementType;
  className?: string;
  title?: string;
}

export function Text({
  children,
  variant = "body",
  color = "text",
  lines = 1,
  wrap = false,
  center = false,
  selectable = false,
  tabular = false,
  as: Element = "span",
  className,
  title,
}: TextProps) {
  if (children === null || children === undefined || children === "") return null;
  const clamp = wrap && lines !== null && lines > 0;
  const style: CSSProperties = { color: cssVar(color), ...(clamp ? { WebkitLineClamp: lines } : {}) };
  return (
    <Element
      className={cx(
        styles.text,
        typography[variant],
        !wrap && styles.single,
        wrap && styles.wrap,
        clamp && styles.clamp,
        center && styles.center,
        selectable && styles.selectable,
        tabular && typography.tabular,
        className,
      )}
      style={style}
      title={title}
    >
      {children}
    </Element>
  );
}
