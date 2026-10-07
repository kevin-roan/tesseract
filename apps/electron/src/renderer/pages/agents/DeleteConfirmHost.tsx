import { useRef } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useRunActions } from "../../features/agents/hooks/use-run-actions";
import { formatLabel, MANAGE_LABELS } from "../../features/agents/labels";
import { countLabel } from "../../features/agents/model";
import { useAgentsUi, type PendingDelete } from "../../features/agents/store";

export function DeleteConfirmHost() {
  const pending = useAgentsUi((state) => state.pendingDelete);
  const actions = useRunActions();
  const last = useRef<PendingDelete | null>(null);
  if (pending) last.current = pending;
  const shown = pending ?? last.current;
  const count = countLabel(shown?.count ?? 0);
  return (
    <ConfirmDialog
      open={pending !== null}
      heading={formatLabel(MANAGE_LABELS.confirmTitle, { count })}
      body={formatLabel(MANAGE_LABELS.confirmBody, { count })}
      confirmLabel={MANAGE_LABELS.confirmYes}
      cancelLabel={MANAGE_LABELS.confirmNo}
      onConfirm={() => {
        if (shown) void actions.confirmDelete(shown);
      }}
      onClose={actions.cancelDelete}
    />
  );
}
