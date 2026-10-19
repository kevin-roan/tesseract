import { useMemo } from "react";
import { IconButton } from "../../components/IconButton";
import { SHELL_LABELS } from "../../features/shell/labels";
import { usePageHeader } from "../../shell";

export interface HostLockActionOptions {
  title: string;
  visible: boolean;
  onLock(): void;
}

export function useHostLockHeader({ title, visible, onLock }: HostLockActionOptions): void {
  const actions = useMemo(() => (visible ? <IconButton icon="confidential" label={SHELL_LABELS.lock} onClick={onLock} /> : null), [visible, onLock]);
  usePageHeader({ title, actions });
}
