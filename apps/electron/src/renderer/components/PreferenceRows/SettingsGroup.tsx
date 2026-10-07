import { Children, type AriaRole, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./PreferenceRows.module.css";

export interface SettingsGroupProps {
  title?: string;
  description?: ReactNode;
  headerSuffix?: ReactNode;
  actions?: ReactNode;
  listRole?: AriaRole;
  listLabel?: string;
  children?: ReactNode;
  className?: string;
}

export function SettingsGroup({ title, description, headerSuffix, actions, listRole, listLabel, children, className }: SettingsGroupProps) {
  const hasRows = Children.toArray(children).length > 0;
  const hasHeader = Boolean(title || description || headerSuffix);
  return (
    <section className={cx(styles.group, className)}>
      {hasHeader ? (
        <header className={styles.groupHeader}>
          <div className={styles.groupText}>
            {title ? <h3 className={styles.groupTitle}>{title}</h3> : null}
            {description ? <p className={styles.groupDescription}>{description}</p> : null}
          </div>
          {headerSuffix ? <div className={styles.groupSuffix}>{headerSuffix}</div> : null}
        </header>
      ) : null}
      {hasRows ? (
        <div className={styles.list} role={listRole} aria-label={listRole ? (listLabel ?? title) : undefined}>
          {children}
        </div>
      ) : null}
      {actions}
    </section>
  );
}
