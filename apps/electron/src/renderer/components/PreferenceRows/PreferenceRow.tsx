import type { AriaRole, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";
import { useRowActivation } from "./use-row-activation";
import styles from "./PreferenceRows.module.css";

export interface PreferenceRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "prefix" | "property"> {
  title: ReactNode;
  subtitle?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onActivate?(): void;
  disabled?: boolean;
  property?: boolean;
  selectable?: boolean;
  nested?: boolean;
  role?: AriaRole;
  titleId?: string;
}

export function PreferenceRow({
  title,
  subtitle,
  prefix,
  suffix,
  onActivate,
  disabled = false,
  property = false,
  selectable = false,
  nested = false,
  role,
  titleId,
  className,
  onClick,
  onKeyDown,
  ...rest
}: PreferenceRowProps) {
  const activation = useRowActivation(onActivate, disabled);
  const activatable = Boolean(onActivate);
  const hasSubtitle = subtitle !== undefined && subtitle !== null && subtitle !== "";
  return (
    <div
      {...rest}
      role={role ?? (activatable ? "button" : undefined)}
      tabIndex={activatable && !disabled ? (rest.tabIndex ?? 0) : rest.tabIndex}
      aria-disabled={disabled || undefined}
      data-activatable={activatable || undefined}
      data-disabled={disabled || undefined}
      className={cx(styles.row, property ? styles.property : null, nested ? styles.nested : null, className)}
      onClick={(event) => {
        onClick?.(event);
        activation.onClick(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented) activation.onKeyDown(event);
      }}
    >
      {prefix ? <div className={styles.prefix}>{prefix}</div> : null}
      <div className={styles.text}>
        <div id={titleId} className={styles.title}>
          {title}
        </div>
        {hasSubtitle ? <div className={cx(styles.subtitle, selectable ? styles.selectable : null)}>{subtitle}</div> : null}
      </div>
      {suffix ? <div className={styles.suffix}>{suffix}</div> : null}
    </div>
  );
}
