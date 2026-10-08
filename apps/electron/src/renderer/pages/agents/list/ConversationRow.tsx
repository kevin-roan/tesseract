import type { AgentRun } from "@tesseract/protocol";
import { motion } from "motion/react";
import type { CSSProperties, KeyboardEvent } from "react";
import { Text } from "../../../components/Text";
import { Tooltip } from "../../../components/Tooltip";
import { formatRelativeTime } from "../../../features/agents/format";
import { rowMeta, runTitle, type ProjectNames } from "../../../features/agents/model";
import type { ProjectBadge } from "../../../features/agents/tints";
import { cx } from "../../../lib/cx";
import { rise } from "../../../theme/motion";
import { ProjectLogo } from "../shared/ProjectLogo";
import { StateGlyph } from "../shared/StateGlyph";
import { useRowMenu } from "./use-row-menu";
import styles from "./ConversationList.module.css";

export interface ConversationRowProps {
  run: AgentRun;
  names: ProjectNames;
  badge: ProjectBadge;
  followUp: boolean;
  unread: boolean;
  selected: boolean;
  archivedView: boolean;
  now: number;
  onSelect(runId: string): void;
}

export function ConversationRow({ run, names, badge, followUp, unread, selected, archivedView, now, onSelect }: ConversationRowProps) {
  const title = runTitle(run.prompt);
  const menu = useRowMenu(run, archivedView);
  const style = badge.tint === null ? undefined : ({ "--row-tint": `var(--to-tint-${badge.tint})` } as CSSProperties);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    menu.handlers.onKeyDown(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(run.id);
    }
  };
  return (
    <>
      <Tooltip label={title} placement="bottom">
        <motion.div
          layout="position"
          variants={rise}
          initial="initial"
          animate="animate"
          role="option"
          aria-selected={selected}
          tabIndex={0}
          data-run-id={run.id}
          className={cx(styles.row, badge.tint !== null && styles.tinted, selected && styles.selected)}
          style={style}
          onClick={() => onSelect(run.id)}
          onKeyDown={onKeyDown}
          onContextMenu={menu.handlers.onContextMenu}
          onPointerDown={menu.handlers.onPointerDown}
          onPointerMove={menu.handlers.onPointerMove}
          onPointerUp={menu.handlers.onPointerUp}
          onPointerCancel={menu.handlers.onPointerCancel}
        >
          <StateGlyph state={run.state} className={styles.rowGlyph} />
          <div className={styles.rowText}>
            <div className={styles.rowTop}>
              <Text variant="label" className={styles.grow}>
                {title}
              </Text>
              <Text variant="caption" color="text-tertiary" className={styles.time}>
                {formatRelativeTime(run.startedAt, now)}
              </Text>
            </div>
            <div className={styles.rowBottom}>
              <ProjectLogo slug={badge.logo} className={styles.rowLogo} />
              <Text variant="caption" color="text-secondary" className={styles.grow}>
                {rowMeta(run, names, followUp)}
              </Text>
              {unread ? <span className={styles.unreadDot} aria-hidden /> : null}
            </div>
          </div>
        </motion.div>
      </Tooltip>
      {menu.element}
    </>
  );
}
