import { MODEL_LABELS } from "../../../features/agents/labels";
import { MODEL_OPTIONS, type ModelKey } from "../../../features/agents/model";
import { PickerPill } from "./PickerPill";

export interface ModelPickerProps {
  value: ModelKey;
  disabled?: boolean;
  onChange(model: ModelKey): void;
}

export function ModelPicker({ value, disabled, onChange }: ModelPickerProps) {
  return <PickerPill icon="cpu" options={MODEL_OPTIONS} value={value} onChange={onChange} tooltip={MODEL_LABELS.model} disabled={disabled} />;
}
