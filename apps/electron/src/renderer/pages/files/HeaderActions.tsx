import { IconButton } from "../../components/IconButton";
import { FILES_LABELS } from "../../features/files/labels";

export interface HeaderActionsProps {
  onRefresh(): void;
}

export function HeaderActions({ onRefresh }: HeaderActionsProps) {
  return <IconButton icon="refresh" label={FILES_LABELS.refresh} onClick={onRefresh} />;
}
