import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { DEFAULT_PAGE, ROUTE } from "../../../shared/routes";
import { runtime } from "../../app/runtime";
import { errorMessage, useFormState, useResetOnOpen, useSubmitAction } from "../../components/FormDialog";
import { ipc } from "../../lib/ipc";
import { ONBOARDING_STATE_KEY } from "../shell";
import { REMOTE_FIELDS } from "./constants";
import { isPairingLink, remoteInput, type RemoteField } from "./remote";

export function useConnectRemote(open: boolean) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const form = useFormState<RemoteField>(REMOTE_FIELDS);
  const action = useSubmitAction();
  useResetOnOpen(open, () => {
    form.reset();
    action.reset();
  });

  const submit = async () => {
    const input = remoteInput(form.values.address, form.values.token);
    if (!input.ok) return form.fail(input.errors);
    const connected = await action.run(async () => {
      const next = await ipc.onboarding.connectRemote(input.value);
      client.setQueryData(ONBOARDING_STATE_KEY, next);
      await ipc.window.openMain().catch(() => undefined);
    }, errorMessage);
    if (connected && runtime.windowKind !== "onboarding") navigate(ROUTE.page(DEFAULT_PAGE));
  };

  return {
    form,
    busy: action.busy,
    error: action.error,
    tokenNeeded: !isPairingLink(form.values.address),
    submit: () => void submit(),
  };
}
