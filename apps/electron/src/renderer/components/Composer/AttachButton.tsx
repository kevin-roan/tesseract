import { useRef } from "react";
import { cx } from "../../lib/cx";
import { ActionMenu, useActionMenu } from "../ActionMenu";
import { IconButton } from "../IconButton";
import { ATTACH_MENU } from "./constants";
import { COMPOSER_LABELS } from "./labels";
import type { AttachKind } from "./model";
import styles from "./AttachButton.module.css";

export type AttachButtonSize = 24 | 28 | 32;

export interface AttachButtonProps {
  onAttach(kind: AttachKind): void;
  size?: AttachButtonSize;
  disabled?: boolean;
  kinds?: readonly AttachKind[];
  className?: string;
}

export function AttachButton({ onAttach, size = 28, disabled = false, kinds, className }: AttachButtonProps) {
  const menu = useActionMenu();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const entries = ATTACH_MENU.filter((item) => !kinds || kinds.includes(item.id)).map((item) => ({
    id: item.id,
    label: COMPOSER_LABELS[item.label],
    icon: item.icon,
    onSelect: () => onAttach(item.id),
  }));
  return (
    <span ref={triggerRef} className={styles.anchor}>
      <IconButton
        icon="attach"
        label={COMPOSER_LABELS.attach}
        variant={size === 24 ? "flat" : "round"}
        size={size}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        data-open={menu.open || undefined}
        className={cx(styles.attach, size === 32 && styles.large, className)}
        onClick={(event) => (menu.open ? menu.close() : menu.openBelow(event.currentTarget))}
      />
      <ActionMenu anchor={menu.anchor} sections={[entries]} onClose={menu.close} ariaLabel={COMPOSER_LABELS.attach} ignoreRef={triggerRef} />
    </span>
  );
}
