import { useId } from "react";
import { Switch } from "../Switch";
import { PreferenceRow } from "./PreferenceRow";

export interface SwitchRowProps {
  title: string;
  subtitle?: string;
  checked: boolean;
  onChange?(checked: boolean): void;
  disabled?: boolean;
}

export function SwitchRow({ title, subtitle, checked, onChange, disabled = false }: SwitchRowProps) {
  const titleId = useId();
  return (
    <PreferenceRow
      title={title}
      subtitle={subtitle}
      titleId={titleId}
      disabled={disabled}
      onActivate={onChange ? () => onChange(!checked) : undefined}
      tabIndex={-1}
      role="presentation"
      suffix={<Switch checked={checked} onChange={onChange} disabled={disabled} aria-labelledby={titleId} />}
    />
  );
}
