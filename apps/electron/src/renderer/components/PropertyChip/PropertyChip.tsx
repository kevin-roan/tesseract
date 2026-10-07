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
}

export function PropertyChip({ label, icon, color, maxChars, tooltip, className }: PropertyChipProps) {
  if (!label) return null;
  const shown = truncateChars(label, maxChars);
  const hint = tooltip ?? (shown === label ? undefined : label);
  const chip = (
    <span className={cx(styles.chip, className)}>
      {icon ? (
        <span className={styles.icon}>
          <Icon name={icon} color={color} />
        </span>
      ) : null}
      <span className={styles.label}>{shown}</span>
    </span>
  );
  return hint ? <Tooltip label={hint}>{chip}</Tooltip> : chip;
}
