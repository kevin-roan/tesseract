import type { Ref } from "react";
import { cx } from "../../lib/cx";
import type { SemanticColor } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip";
import { truncateChars } from "./truncate";
import styles from "./PropertyChip.module.css";

export interface PropertyChipProps {
  label: string | null | undefined;
  icon?: IconName;
  color?: SemanticColor;
  maxChars?: number;
  tooltip?: string;
  className?: string;
  expanded?: boolean;
  ref?: Ref<HTMLButtonElement>;
  onClick?(): void;
}

export function PropertyChip({ label, icon, color, maxChars, tooltip, className, expanded, ref, onClick }: PropertyChipProps) {
  if (!label) return null;
  const shown = truncateChars(label, maxChars);
  const hint = tooltip ?? (shown === label ? undefined : label);
  const content = (
    <>
      {icon ? (
        <span className={styles.icon}>
          <Icon name={icon} color={color} />
        </span>
      ) : null}
      <span className={styles.label}>{shown}</span>
    </>
  );
  const chip = onClick ? (
    <button
      ref={ref}
      type="button"
      className={cx(styles.chip, styles.interactive, className)}
      aria-haspopup={expanded === undefined ? undefined : "dialog"}
      aria-expanded={expanded}
      data-open={expanded || undefined}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <span className={cx(styles.chip, className)}>{content}</span>
  );
  return hint ? <Tooltip label={hint}>{chip}</Tooltip> : chip;
}
