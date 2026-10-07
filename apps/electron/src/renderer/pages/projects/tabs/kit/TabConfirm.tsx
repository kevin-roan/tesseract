import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import type { ConfirmState } from "./use-confirm";

export interface TabConfirmProps {
  state: ConfirmState;
}

export function TabConfirm({ state }: TabConfirmProps) {
  const request = state.request;
  if (!request) return null;
  return (
    <ConfirmDialog
      key={request.heading}
      open={state.open}
      heading={request.heading}
      body={request.body}
      confirmLabel={request.confirmLabel}
      cancelLabel={request.cancelLabel}
      destructive={request.destructive ?? true}
      options={request.options}
      chooseLabel={request.chooseLabel}
      onConfirm={request.onConfirm}
      onClose={state.close}
      onExitComplete={state.clear}
    />
  );
}
