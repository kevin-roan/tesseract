import type { Issue, IssueAssignee, IssuePriority, IssueStatus } from "@tesseract/protocol";
import { Avatar } from "../../../../components/Avatar";
import { ClaudeMark } from "../../../../components/ClaudeMark";
import { Icon } from "../../../../components/Icon";
import { Spinner } from "../../../../components/Spinner";
import { Tooltip } from "../../../../components/Tooltip";
import { cx } from "../../../../lib/cx";
import { GLYPH_SIZE, PRIORITY_GEOMETRY, STATUS_APPEARANCE } from "./constants";
import { AGENT_LABELS, ASSIGNEE_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "./labels";
import { agentIndicator } from "./model";
import { priorityBars } from "./priority";
import styles from "./IssueGlyphs.module.css";

export function StatusIcon({ status, size = GLYPH_SIZE.glyph }: { status: IssueStatus; size?: number }) {
  const { icon, color } = STATUS_APPEARANCE[status];
  return <Icon name={icon} color={color} size={size} label={STATUS_LABELS[status]} />;
}

export function PriorityIcon({ priority }: { priority: IssuePriority }) {
  const { box, radius } = PRIORITY_GEOMETRY;
  const label = PRIORITY_LABELS[priority];
  return (
    <Tooltip label={label}>
      <svg
        className={cx(styles.priority, priority === "urgent" && styles.urgent)}
        width={GLYPH_SIZE.glyph}
        height={GLYPH_SIZE.glyph}
        viewBox={`0 0 ${box} ${box}`}
        role="img"
        aria-label={label}
      >
        {priority === "urgent" ? (
          <>
            <rect x={1.5} y={1.5} width={box - 3} height={box - 3} rx={radius * 3} fill="currentColor" />
            <rect x={box / 2 - 0.9} y={4} width={1.8} height={5} rx={0.9} className={styles.urgentMark} />
            <circle cx={box / 2} cy={11.3} r={1} className={styles.urgentMark} />
          </>
        ) : (
          priorityBars(priority).map((bar) => (
            <rect
              key={bar.x}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={radius}
              fill="currentColor"
              className={bar.filled ? undefined : styles.dim}
            />
          ))
        )}
      </svg>
    </Tooltip>
  );
}

export function AssigneeAvatar({ assignee, size = GLYPH_SIZE.avatar }: { assignee: IssueAssignee | null; size?: number }) {
  if (assignee === "claude") return <ClaudeMark size={size} badge label={ASSIGNEE_LABELS.claude} />;
  if (assignee === "me") return <Avatar name={ASSIGNEE_LABELS.me} size={size} />;
  return (
    <Tooltip label={ASSIGNEE_LABELS.none}>
      <span className={styles.unassigned} style={{ width: size, height: size }}>
        <Icon name="assignee" color="text-tertiary" size={size - 2} label={ASSIGNEE_LABELS.none} />
      </span>
    </Tooltip>
  );
}

export function AgentIndicator({ issue }: { issue: Pick<Issue, "agentState"> }) {
  const indicator = agentIndicator(issue);
  if (indicator === "running") {
    return (
      <Tooltip label={AGENT_LABELS.running}>
        <span className={styles.agent}>
          <Spinner size={GLYPH_SIZE.spinner} label={AGENT_LABELS.running} />
        </span>
      </Tooltip>
    );
  }
  if (indicator === "failed") {
    return (
      <Tooltip label={AGENT_LABELS.failed}>
        <span className={styles.agent}>
          <Icon name="failed" color="danger" size={GLYPH_SIZE.glyph} label={AGENT_LABELS.failed} />
        </span>
      </Tooltip>
    );
  }
  return null;
}

export function LabelPills({ labels, className }: { labels: readonly string[]; className?: string }) {
  if (labels.length === 0) return null;
  return (
    <span className={cx(styles.labels, className)}>
      {labels.map((label) => (
        <span key={label} className={styles.label}>
          <span className={styles.labelDot} aria-hidden />
          {label}
        </span>
      ))}
    </span>
  );
}
