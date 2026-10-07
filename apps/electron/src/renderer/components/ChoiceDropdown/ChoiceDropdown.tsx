import { useId } from "react";
import { cx } from "../../lib/cx";
import { Floating, MenuItem } from "../ActionMenu";
import { Tooltip } from "../Tooltip";
import { CARET_PATH, CARET_SIZE } from "./constants";
import { choiceLabel, type ChoiceOption } from "./model";
import { useChoiceDropdown } from "./use-choice-dropdown";
import styles from "./ChoiceDropdown.module.css";

export type ChoiceDropdownVariant = "default" | "toolbar";

export interface ChoiceDropdownProps<T extends string = string> {
  options: readonly ChoiceOption<T>[];
  value: NoInfer<T> | null | undefined;
  onChange?(id: NoInfer<T>): void;
  tooltip?: string;
  ariaLabel?: string;
  variant?: ChoiceDropdownVariant;
  disabled?: boolean;
  className?: string;
}

export function ChoiceDropdown<T extends string = string>({
  options,
  value,
  onChange,
  tooltip,
  ariaLabel,
  variant = "default",
  disabled = false,
  className,
}: ChoiceDropdownProps<T>) {
  const listId = useId();
  const dropdown = useChoiceDropdown(options, value, onChange);
  return (
    <>
      <Tooltip label={dropdown.isOpen ? null : tooltip}>
        <button
          ref={dropdown.triggerRef}
          type="button"
          aria-label={ariaLabel ?? tooltip}
          aria-haspopup="listbox"
          aria-expanded={dropdown.isOpen}
          aria-controls={dropdown.isOpen ? listId : undefined}
          disabled={disabled || options.length === 0}
          data-open={dropdown.isOpen || undefined}
          className={cx(styles.trigger, styles[variant], className)}
          onClick={dropdown.toggle}
          onKeyDown={dropdown.onTriggerKeyDown}
        >
          <span className={styles.label}>{choiceLabel(options, dropdown.selected)}</span>
          <svg className={styles.arrow} width={CARET_SIZE} height={CARET_SIZE} viewBox={`0 0 ${CARET_SIZE} ${CARET_SIZE}`} aria-hidden>
            <path d={CARET_PATH} fill="currentColor" />
          </svg>
        </button>
      </Tooltip>
      <Floating
        open={dropdown.isOpen}
        anchor={dropdown.anchor}
        onClose={dropdown.close}
        role="listbox"
        id={listId}
        ariaLabel={ariaLabel ?? tooltip}
        minWidth={dropdown.width}
        ignoreRef={dropdown.triggerRef}
      >
        {options.map((option) => (
          <MenuItem
            key={option.id}
            role="option"
            aria-selected={option.id === dropdown.selected}
            label={option.label}
            selected={option.id === dropdown.selected}
            disabled={option.disabled}
            showCheck
            onClick={() => dropdown.pick(option.id)}
          />
        ))}
      </Floating>
    </>
  );
}
