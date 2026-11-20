import { useMemo, type CSSProperties } from "react";
import { SegmentedControl, type SegmentOption } from "../../../components/SegmentedControl";
import { ALL_PROJECTS_KEY } from "../../../features/agents/constants";
import { LIST_LABELS } from "../../../features/agents/labels";
import type { ProjectFilterOption } from "../../../features/agents/model";
import { projectBadge, type ProjectBadge } from "../../../features/agents/tints";
import { cx } from "../../../lib/cx";
import styles from "./ConversationList.module.css";

export interface ProjectFilterBarProps {
  options: readonly ProjectFilterOption[];
  badges: Readonly<Record<string, ProjectBadge>>;
  value: string;
  onChange(projectFilter: string): void;
}

function ProjectDot({ tint }: { tint: number | null }) {
  const style = tint === null ? undefined : ({ "--project-tint": `var(--to-tint-${tint})` } as CSSProperties);
  return <span className={cx(styles.projectDot, tint !== null && styles.projectDotTinted)} style={style} aria-hidden />;
}

export function ProjectFilterBar({ options, badges, value, onChange }: ProjectFilterBarProps) {
  const segments = useMemo<SegmentOption[]>(
    () => [
      { id: ALL_PROJECTS_KEY, label: LIST_LABELS.allProjects },
      ...options.map((option) => ({ id: option.id, label: option.label, adornment: <ProjectDot tint={projectBadge(option.projectId, badges).tint} /> })),
    ],
    [options, badges],
  );
  if (options.length < 2 && value === ALL_PROJECTS_KEY) return null;
  return (
    <div className={styles.projectFilter}>
      <SegmentedControl scrollable options={segments} value={value} onChange={onChange} ariaLabel={LIST_LABELS.projectFilter} />
    </div>
  );
}
