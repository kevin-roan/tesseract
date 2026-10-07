import type { IconName } from "../../theme/icons";
import { IconButton } from "../IconButton";

export interface ToolbarToggleProps {
  icon: IconName;
  label: string;
  active: boolean;
  onToggle(active: boolean): void;
  disabled?: boolean;
  className?: string;
}

export function ToolbarToggle({ icon, label, active, onToggle, disabled, className }: ToolbarToggleProps) {
  return (
    <IconButton
      icon={icon}
      label={label}
      variant="bordered"
      toggle
      checked={active}
      disabled={disabled}
      className={className}
      onClick={() => onToggle(!active)}
    />
  );
}
