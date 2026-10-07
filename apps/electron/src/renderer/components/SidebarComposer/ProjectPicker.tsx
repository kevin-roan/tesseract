import { useId } from "react";
import { cx } from "../../lib/cx";
import { Floating, MenuItem } from "../ActionMenu";
import { useChoiceDropdown } from "../ChoiceDropdown";
import { Icon } from "../Icon";
import { NO_PROJECT_ID, PICKER_CARET_PATH, PICKER_CARET_SIZE } from "./constants";
import { SIDEBAR_COMPOSER_LABELS } from "./labels";
import { type PickerProject, pickerChoices } from "./model";
import styles from "./ProjectPicker.module.css";

export type ProjectPickerVariant = "flat" | "pill";

export interface ProjectPickerProps {
  projects: readonly PickerProject[];
  value: string | null;
  onChange(projectId: string | null): void;
  variant?: ProjectPickerVariant;
  disabled?: boolean;
  className?: string;
}

export function ProjectPicker({ projects, value, onChange, variant = "flat", disabled = false, className }: ProjectPickerProps) {
  const listId = useId();
  const choices = pickerChoices(projects, SIDEBAR_COMPOSER_LABELS.noProject);
  const dropdown = useChoiceDropdown(choices, value ?? NO_PROJECT_ID, (id) => onChange(id === NO_PROJECT_ID ? null : id));
  const tooltip = variant === "pill" ? SIDEBAR_COMPOSER_LABELS.projectPillTooltip : SIDEBAR_COMPOSER_LABELS.projectTooltip;
  const label = choices.find((choice) => choice.id === dropdown.selected)?.label ?? SIDEBAR_COMPOSER_LABELS.noProject;
  return (
    <>
      <button
        ref={dropdown.triggerRef}
        type="button"
        className={cx(styles.button, styles[variant], className)}
        title={tooltip}
        aria-label={tooltip}
        aria-haspopup="listbox"
        aria-expanded={dropdown.isOpen}
        aria-controls={dropdown.isOpen ? listId : undefined}
        data-open={dropdown.isOpen || undefined}
        disabled={disabled}
        onClick={dropdown.toggle}
        onKeyDown={dropdown.onTriggerKeyDown}
      >
        {variant === "pill" ? <Icon name="project" className={styles.icon} /> : null}
        <span className={styles.label}>{label}</span>
        {variant === "flat" ? (
          <svg className={styles.caret} width={PICKER_CARET_SIZE} height={PICKER_CARET_SIZE} viewBox={`0 0 ${PICKER_CARET_SIZE} ${PICKER_CARET_SIZE}`} aria-hidden>
            <path d={PICKER_CARET_PATH} fill="currentColor" />
          </svg>
        ) : null}
      </button>
      <Floating
        open={dropdown.isOpen}
        anchor={dropdown.anchor}
        onClose={dropdown.close}
        role="listbox"
        id={listId}
        ariaLabel={tooltip}
        className={styles.menu}
        ignoreRef={dropdown.triggerRef}
      >
        {choices.map((choice) => (
          <MenuItem
            key={choice.id}
            role="option"
            aria-selected={choice.id === dropdown.selected}
            label={choice.label}
            selected={choice.id === dropdown.selected}
            showCheck
            onClick={() => dropdown.pick(choice.id)}
          />
        ))}
      </Floating>
    </>
  );
}
