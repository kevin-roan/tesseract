import type { ReactNode } from "react";
import { PreferenceRow } from "../../../components/PreferenceRows";
import { RadioIndicator } from "../../../components/RadioRows";

export interface ChoiceRowProps {
  title: string;
  subtitle?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onSelect(): void;
}

export function ChoiceRow({ title, subtitle, checked, disabled = false, onSelect }: ChoiceRowProps) {
  return (
    <PreferenceRow
      role="radio"
      aria-checked={checked}
      title={title}
      subtitle={subtitle}
      disabled={disabled}
      prefix={<RadioIndicator checked={checked} />}
      onActivate={checked ? undefined : onSelect}
      tabIndex={disabled ? -1 : 0}
    />
  );
}
