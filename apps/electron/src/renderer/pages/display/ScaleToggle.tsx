import { motion } from "motion/react";
import { useId } from "react";
import { Tooltip } from "../../components/Tooltip";
import { DISPLAY_LABELS } from "../../features/display/labels";
import { transition } from "../../theme/motion";
import { SCALE_OPTIONS } from "./config";
import styles from "./DisplayToolbar.module.css";

export interface ScaleToggleProps {
  fit: boolean;
  disabled: boolean;
  onChange(fit: boolean): void;
}

export function ScaleToggle({ fit, disabled, onChange }: ScaleToggleProps) {
  const indicator = useId();
  return (
    <div role="radiogroup" aria-label={DISPLAY_LABELS.scaleLabel} className={styles.scale}>
      {SCALE_OPTIONS.map((option) => {
        const checked = option.fit === fit;
        return (
          <Tooltip key={option.id} label={option.tooltip}>
            <button
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option.tooltip}
              data-checked={checked || undefined}
              disabled={disabled}
              className={styles.pill}
              onClick={() => {
                if (!checked) onChange(option.fit);
              }}
            >
              {checked ? <motion.span layoutId={indicator} className={styles.pillIndicator} transition={transition.normal} /> : null}
              <span className={styles.pillLabel}>{option.label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
