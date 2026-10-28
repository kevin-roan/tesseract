import { cx } from "../../lib/cx";
import { Tooltip } from "../Tooltip";
import { CLAUDE_MARK_DEFAULT_SIZE, CLAUDE_MARK_GEOMETRY } from "./constants";
import { claudeRays } from "./rays";
import styles from "./ClaudeMark.module.css";

export interface ClaudeMarkProps {
  size?: number;
  label?: string;
  badge?: boolean;
  className?: string;
}

const RAYS = claudeRays();

export function ClaudeMark({ size = CLAUDE_MARK_DEFAULT_SIZE, label, badge = false, className }: ClaudeMarkProps) {
  const { box, stroke } = CLAUDE_MARK_GEOMETRY;
  return (
    <Tooltip label={label}>
      <span
        className={cx(styles.mark, badge && styles.badge, className)}
        style={{ width: size, height: size }}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <svg viewBox={`0 0 ${box} ${box}`} width="100%" height="100%" aria-hidden focusable={false}>
          {RAYS.map((ray, index) => (
            <line key={index} {...ray} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
          ))}
        </svg>
      </span>
    </Tooltip>
  );
}
