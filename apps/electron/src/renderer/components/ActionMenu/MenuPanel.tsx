import { useRef, type AriaRole, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { OverlayScrollbar } from "../OverlayScrollbar";
import styles from "./MenuPanel.module.css";

export interface MenuPanelProps {
  children: ReactNode;
  role?: AriaRole;
  ariaLabel?: string;
  className?: string;
  bodyClassName?: string;
}

export function MenuPanel({ children, role = "menu", ariaLabel, className, bodyClassName }: MenuPanelProps) {
  return (
    <div role={role} aria-label={ariaLabel} className={cx(styles.panel, className)}>
      <MenuBody className={bodyClassName}>{children}</MenuBody>
    </div>
  );
}

export interface MenuBodyProps {
  children: ReactNode;
  className?: string;
}

export function MenuBody({ children, className }: MenuBodyProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={ref} className={cx(styles.body, className)}>
        {children}
      </div>
      <OverlayScrollbar target={ref} />
    </>
  );
}

export interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon?: IconName;
  danger?: boolean;
  selected?: boolean;
  showCheck?: boolean;
}

export function MenuItem({
  label,
  icon,
  danger = false,
  selected = false,
  showCheck = false,
  className,
  type = "button",
  role = "menuitem",
  ...rest
}: MenuItemProps) {
  return (
    <button
      {...rest}
      type={type}
      role={role}
      tabIndex={-1}
      data-selected={selected || undefined}
      data-danger={danger || undefined}
      className={cx(styles.item, className)}
    >
      {icon ? <Icon name={icon} className={styles.itemIcon} /> : null}
      <span className={styles.itemLabel}>{label}</span>
      {showCheck ? <Icon name="check" className={cx(styles.check, selected ? styles.checkVisible : null)} /> : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className={styles.separator} />;
}
