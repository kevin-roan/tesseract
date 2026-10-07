import { IconButton } from "../../components/IconButton";
import type { IconName } from "../../theme/icons";

export interface HeaderAction {
  id: string;
  icon: IconName;
  label: string;
  onClick(): void;
}

export interface HeaderActionsProps {
  items: readonly HeaderAction[];
}

export function HeaderActions({ items }: HeaderActionsProps) {
  return (
    <>
      {items.map((item) => (
        <IconButton key={item.id} icon={item.icon} label={item.label} onClick={item.onClick} />
      ))}
    </>
  );
}
