import { useRef } from "react";
import { ActionMenu, useActionMenu, type MenuSections } from "../../components/ActionMenu";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { StatusBadge } from "../../components/StatusBadge";
import { Text } from "../../components/Text";
import { ACTION_LABELS } from "../../features/terminals/labels";
import type { BadgeModel } from "../../features/terminals/types";
import type { IconName } from "../../theme/icons";
import styles from "./TerminalToolbar.module.css";

export interface ToolbarSession {
  icon: IconName;
  title: string;
  subtitle: string | null;
  badge: BadgeModel;
  ended: boolean;
}

export interface TerminalToolbarProps {
  collapsed: boolean;
  session: ToolbarSession | null;
  menu: MenuSections;
  onToggleSidebar(): void;
  onRestart(): void;
  onClose(): void;
}

export function TerminalToolbar({ collapsed, session, menu, onToggleSidebar, onRestart, onClose }: TerminalToolbarProps) {
  const actions = useActionMenu();
  const moreRef = useRef<HTMLSpanElement>(null);
  return (
    <div className={styles.toolbar}>
      {collapsed ? <IconButton className={styles.action} icon="sidebar" label={ACTION_LABELS.sessions} onClick={onToggleSidebar} /> : null}
      {session ? (
        <>
          <Icon name={session.icon} size={16} color="text-secondary" className={styles.kind} />
          <div className={styles.titles}>
            <Text variant="label" className={styles.title}>
              {session.title}
            </Text>
            <StatusBadge label={session.badge.label} tone={session.badge.tone} live={session.badge.tone === "success"} className={styles.badge} />
            <Text variant="caption" color="text-tertiary" className={styles.subtitle}>
              {session.subtitle}
            </Text>
          </div>
          {session.ended ? <IconButton className={styles.action} icon="refresh" label={ACTION_LABELS.restart} onClick={onRestart} /> : null}
          <IconButton className={styles.action} icon="close" label={session.ended ? ACTION_LABELS.remove : ACTION_LABELS.close} onClick={onClose} />
          <span ref={moreRef} className={styles.more}>
            <IconButton
              className={styles.action}
              icon="more"
              label={ACTION_LABELS.more}
              checked={actions.open}
              aria-haspopup="menu"
              onClick={(event) => (actions.open ? actions.close() : actions.openBelow(event.currentTarget))}
            />
          </span>
          <ActionMenu anchor={actions.anchor} sections={menu} onClose={actions.close} ariaLabel={ACTION_LABELS.more} ignoreRef={moreRef} />
        </>
      ) : null}
    </div>
  );
}
