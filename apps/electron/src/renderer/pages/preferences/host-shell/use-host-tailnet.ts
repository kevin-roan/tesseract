import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { HOST_TAILNET_MODES, type HostTailnetMode, type HostTailnetState } from "../../../../shared/contracts/tailnet";
import { errorMessage } from "../../../components/FormDialog";
import type { RadioChoice } from "../../../components/RadioRows";
import { TAILNET_STATE_KEY } from "../../../features/account/constants";
import { useHostTailnetState } from "../../../features/account/hooks/use-host-tailnet";
import { ipc } from "../../../lib/ipc";
import { usePreferencesToast } from "../shared/use-preferences-toast";
import { HOST_SHELL_LABELS } from "./labels";

const L = HOST_SHELL_LABELS.tailnet;

export const TAILNET_MODE_CHOICES: readonly RadioChoice<HostTailnetMode>[] = HOST_TAILNET_MODES.map((id) => ({ id, ...L.modes[id] }));

export function useHostTailnet() {
  const queryClient = useQueryClient();
  const toast = usePreferencesToast();
  const state = useHostTailnetState();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (task: () => Promise<HostTailnetState>, failure: (error: string) => string) => {
      setBusy(true);
      try {
        queryClient.setQueryData(TAILNET_STATE_KEY, await task());
      } catch (error) {
        toast(failure(errorMessage(error)), true);
      } finally {
        setBusy(false);
      }
    },
    [queryClient, toast],
  );

  const setMode = useCallback((mode: HostTailnetMode) => void run(() => ipc.tailnet.setMode(mode), L.modeFailed), [run]);
  const restart = useCallback(() => void run(() => ipc.tailnet.restart(), L.restartFailed), [run]);
  return { state, busy, setMode, restart };
}
