import { LayoutGroup, motion } from "motion/react";
import { useId, type MouseEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";
import { transition } from "../../theme/motion";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { SidebarCount } from "./SidebarCount";
import { SELECTION_LAYOUT_ID } from "./layout";
import styles from "./Sidebar.module.css";

export interface SidebarNavProps {
  children: ReactNode;
}

export function SidebarNav({ children }: SidebarNavProps) {
  const id = useId();
  return <LayoutGroup id={id}>{children}</LayoutGroup>;
}

export interface SidebarNavRowProps {
  label: string;
  icon?: IconName | LucideIcon;
  count?: number | null;
  selected?: boolean;
  href?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  tooltip?: string;
  className?: string;
}

export function SidebarNavRow({ label, icon, count, selected = false, href, onClick, tooltip, className }: SidebarNavRowProps) {
  const content = (
    <>
      {selected ? <motion.span layoutId={SELECTION_LAYOUT_ID} className={styles.selection} transition={transition.normal} /> : null}
      {icon ? (
        <span className={styles.navIcon}>{typeof icon === "string" ? <Icon name={icon} /> : <Icon icon={icon} />}</span>
      ) : null}
      <Text variant="label" color="text" className={styles.navLabel}>
        {label}
      </Text>
      <SidebarCount count={count} />
    </>
  );
  const shared = {
    className: cx(styles.navRow, selected && styles.selected, className),
    "aria-current": selected ? ("page" as const) : undefined,
    title: tooltip,
    onClick,
  };
  return href ? (
    <a href={href} {...shared}>
      {content}
    </a>
  ) : (
    <button type="button" {...shared}>
      {content}
    </button>
  );
}
