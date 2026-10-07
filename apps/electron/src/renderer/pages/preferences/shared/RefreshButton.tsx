import { IconButton } from "../../../components/IconButton";
import { SHARED_LABELS } from "./labels";

export function RefreshButton({ onClick, disabled }: { onClick(): void; disabled?: boolean }) {
  return <IconButton icon="refresh" label={SHARED_LABELS.refresh} size={28} disabled={disabled} onClick={onClick} />;
}
