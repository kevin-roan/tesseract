import { ChoiceDropdown } from "../../../components/ChoiceDropdown";
import { Icon } from "../../../components/Icon";
import { NEW_LABELS } from "../../../features/agents/labels";
import type { ProjectOption } from "../../../features/agents/model";
import { GLYPH_SIZE } from "../shared/constants";
import styles from "./NewConversationView.module.css";

export interface ProjectPickerProps {
  options: readonly ProjectOption[];
  value: string;
  onChange(projectId: string): void;
}

export function ProjectPicker({ options, value, onChange }: ProjectPickerProps) {
  return (
    <div className={styles.picker}>
      <Icon name="project" size={GLYPH_SIZE} color="text-secondary" />
      <ChoiceDropdown options={options} value={value} onChange={onChange} tooltip={NEW_LABELS.project} className={styles.pickerDropdown} />
    </div>
  );
}
