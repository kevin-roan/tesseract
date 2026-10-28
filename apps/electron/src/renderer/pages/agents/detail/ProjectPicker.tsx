import { NEW_LABELS } from "../../../features/agents/labels";
import type { ProjectOption } from "../../../features/agents/model";
import { PickerPill } from "../shared/PickerPill";

export interface ProjectPickerProps {
  options: readonly ProjectOption[];
  value: string;
  onChange(projectId: string): void;
}

export function ProjectPicker({ options, value, onChange }: ProjectPickerProps) {
  return <PickerPill icon="project" options={options} value={value} onChange={onChange} tooltip={NEW_LABELS.project} />;
}
