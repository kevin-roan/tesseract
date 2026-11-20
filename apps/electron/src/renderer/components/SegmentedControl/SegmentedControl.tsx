import { LayoutGroup, motion } from "motion/react";
import { useCallback, useId, useMemo, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { transition } from "../../theme/motion";
import { Icon } from "../Icon";
import { useRovingChoice } from "./use-roving-choice";
import { useSegmentScroll } from "./use-segment-scroll";
import styles from "./SegmentedControl.module.css";

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  icon?: IconName;
  adornment?: ReactNode;
  disabled?: boolean;
}

export type SegmentedTone = "window" | "dialog";

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentOption<T>[];
  value: NoInfer<T> | null;
  onChange?(id: NoInfer<T>): void;
  ariaLabel?: string;
  tone?: SegmentedTone;
  disabled?: boolean;
  scrollable?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  tone = "window",
  disabled = false,
  scrollable = false,
  className,
}: SegmentedControlProps<T>) {
  const group = useId();
  const ids = useMemo(() => options.filter((option) => !option.disabled).map((option) => option.id), [options]);
  const select = useCallback(
    (id: T) => {
      if (id !== value) onChange?.(id);
    },
    [onChange, value],
  );
  const onKeyDown = useRovingChoice(ids, value, select);
  const scroll = useSegmentScroll(scrollable, value);
  return (
    <LayoutGroup id={group}>
      <motion.div
        ref={scroll.ref}
        layoutScroll={scrollable}
        data-fade-start={scroll.fadeStart || undefined}
        data-fade-end={scroll.fadeEnd || undefined}
        onWheel={scroll.onWheel}
        onScroll={scroll.onScroll}
        role="radiogroup"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        className={cx(styles.track, styles[tone], scrollable && styles.scrollable, className)}
        onKeyDown={disabled ? undefined : onKeyDown}
      >
        {options.map((option) => {
          const checked = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked || (value === null && option.id === ids[0]) ? 0 : -1}
              disabled={disabled || option.disabled}
              data-checked={checked || undefined}
              className={styles.segment}
              onClick={() => select(option.id)}
            >
              {checked ? <motion.span layoutId="segment-pill" className={styles.pill} transition={transition.normal} /> : null}
              <span className={styles.content}>
                {option.icon ? <Icon name={option.icon} /> : null}
                {option.adornment}
                {option.label}
              </span>
            </button>
          );
        })}
      </motion.div>
    </LayoutGroup>
  );
}
