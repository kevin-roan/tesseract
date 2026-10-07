import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import styles from "./ListCard.module.css";

export interface ListCardProps {
  title: string;
  subtitle?: string | null;
  icon?: IconName;
  value?: string | null;
  valueLabel?: string | null;
  accessory?: ReactNode;
  onActivate?: () => void;
  className?: string;
}

export function ListCard({ title, subtitle, icon, value, valueLabel, accessory, onActivate, className }: ListCardProps) {
  const content = (
    <>
      {icon ? (
        <span className={styles.badge}>
          <Icon name={icon} />
        </span>
      ) : null}
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.caption}>{subtitle}</span> : null}
      </span>
      {value || valueLabel ? (
        <span className={styles.values}>
          {value ? <span className={styles.title}>{value}</span> : null}
          {valueLabel ? <span className={styles.caption}>{valueLabel}</span> : null}
        </span>
      ) : null}
      {accessory ? <span className={styles.accessory}>{accessory}</span> : null}
    </>
  );
  if (!onActivate) return <div className={cx(styles.card, className)}>{content}</div>;
  return (
    <button type="button" className={cx(styles.card, styles.pressable, className)} onClick={onActivate}>
      {content}
    </button>
  );
}
