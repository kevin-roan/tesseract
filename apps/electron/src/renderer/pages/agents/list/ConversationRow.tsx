import type { AgentRun } from "@tesseract/protocol";
import { motion } from "motion/react";
import type { CSSProperties, KeyboardEvent } from "react";
import { Text } from "../../../components/Text";
import { Tooltip } from "../../../components/Tooltip";
import { formatShortTime } from "../../../features/agents/format";
import { projectName, rowDetail, runTitle, type ProjectNames } from "../../../features/agents/model";
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
  const detail = rowDetail(run, followUp);
  const tileStyle = badge.tint === null ? undefined : ({ "--project-tint": `var(--to-tint-${badge.tint})` } as CSSProperties);
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
          className={cx(styles.row, selected && styles.selected, unread && styles.unread)}
          onClick={() => onSelect(run.id)}
          onKeyDown={onKeyDown}
          onContextMenu={menu.handlers.onContextMenu}
          onPointerDown={menu.handlers.onPointerDown}
          onPointerMove={menu.handlers.onPointerMove}
          onPointerUp={menu.handlers.onPointerUp}
          onPointerCancel={menu.handlers.onPointerCancel}
        >
          <span className={cx(styles.tile, badge.tint !== null && styles.tileTinted)} style={tileStyle}>
            <ProjectLogo slug={badge.logo} />
            {run.state === "succeeded" ? null : <StateGlyph state={run.state} className={styles.tileStatus} />}
          </span>
          <div className={styles.rowText}>
            <div className={styles.rowTop}>
              <Text variant="label" className={styles.grow}>
                {title}
              </Text>
              {unread ? <span className={styles.unreadDot} aria-hidden /> : null}
              <Text variant="caption" color="text-tertiary" className={styles.time}>
                {formatShortTime(run.startedAt, now)}
              </Text>
            </div>
            <div className={styles.rowBottom}>
              <Text variant="caption" color="text-secondary" className={styles.projectName}>
                {projectName(run.projectId, names)}
              </Text>
              {detail ? (
                <Text variant="caption" color="text-tertiary" className={styles.rowDetail}>
                  {detail}
                </Text>
              ) : null}
            </div>
          </div>
        </motion.div>
      </Tooltip>
      {menu.element}
    </>
  );
}
