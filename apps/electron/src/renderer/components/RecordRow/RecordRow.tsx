import { cx } from "../../lib/cx";
import { cssVar, TONE_COLORS, type SemanticColor, type Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { ProgressBar } from "../ProgressBar";
import { Row } from "../Row";
import { StatusBadge } from "../StatusBadge";
import { DEFAULT_ICON_COLOR, STATUS_GLYPHS } from "./constants";
import { Tooltip } from "../Tooltip";
import { OverflowText } from "./OverflowText";
import { RowActions } from "./RowActions";
import type { RecordStatus, RowAction } from "./types";
import styles from "./RecordRow.module.css";

export interface RecordRowProps {
  title: string;
  subtitle?: string | null;
  icon?: IconName | null;
  iconColor?: SemanticColor;
  code?: string | null;
  codeTone?: Tone;
  monospaceTitle?: boolean;
  monospaceSubtitle?: boolean;
  progress?: number | null;
  progressTone?: Tone;
  progressLabel?: string;
  meta?: string | null;
  status?: RecordStatus | null;
  actions?: readonly RowAction[];
  onActivate?: () => void;
  selected?: boolean;
  className?: string;
}

export function RecordRow({
  title,
  subtitle,
  icon = null,
  iconColor = DEFAULT_ICON_COLOR,
  code,
  codeTone = "neutral",
  monospaceTitle = false,
  monospaceSubtitle = false,
  progress,
  progressTone = "info",
  progressLabel,
  meta,
  status,
  actions = [],
  onActivate,
  selected,
  className,
}: RecordRowProps) {
  const glyph = status?.glyph ? STATUS_GLYPHS[status.tone ?? "neutral"] : null;
  const inline = actions.some((action) => action.labeled);
  const hoverActions = !inline && actions.length > 0 ? <RowActions actions={actions} /> : undefined;
  return (
    <Row onActivate={onActivate} hoverActions={hoverActions} selected={selected} className={cx(styles.row, className)}>
      {glyph ? (
        <Tooltip label={status?.label}>
          <span className={styles.leading}>
            <Icon name={glyph.icon} color={glyph.color} label={status?.label} />
          </span>
        </Tooltip>
      ) : icon ? (
        <span className={styles.leading}>
          <Icon name={icon} color={iconColor} />
        </span>
      ) : null}
      {code ? (
        <span className={styles.code} style={{ color: cssVar(TONE_COLORS[codeTone].fg) }}>
          {code}
        </span>
      ) : null}
      <div className={cx(styles.body, subtitle ? styles.withSubtitle : undefined)}>
        <OverflowText text={title} className={cx(styles.title, monospaceTitle && styles.mono)} />
        {subtitle ? <OverflowText text={subtitle} className={cx(styles.subtitle, monospaceSubtitle && styles.mono)} /> : null}
      </div>
      {progress !== undefined ? (
        <div className={styles.progress}>
          <ProgressBar progress={progress} tone={progressTone} label={progressLabel} />
        </div>
      ) : null}
      {meta ? <OverflowText text={meta} className={styles.meta} /> : null}
      {status && !status.glyph ? <StatusBadge label={status.label} tone={status.tone} live={status.live} /> : null}
      <RowActions actions={inline ? actions : []} />
    </Row>
  );
}
