import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { WindowState } from "../../../shared/contracts/window";
import { ipc } from "../../lib/ipc";
import { WINDOW_STATE_QUERY_KEY } from "./constants";

export interface WindowControlsModel {
  maximized: boolean;
  focused: boolean;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
}

export function useWindowControls(): WindowControlsModel {
  const queryClient = useQueryClient();
  useEffect(() => ipc.window.on("state", (state) => queryClient.setQueryData(WINDOW_STATE_QUERY_KEY, state)), [queryClient]);
  const state = useQuery<WindowState>({
    queryKey: WINDOW_STATE_QUERY_KEY,
    queryFn: () => ipc.window.state(),
    staleTime: Infinity,
    retry: false,
  }).data;
  return {
    maximized: state?.maximized ?? false,
    focused: state?.focused ?? true,
    minimize: () => void ipc.window.minimize().catch(() => undefined),
    toggleMaximize: () =>
      void ipc.window
        .toggleMaximize()
        .then((next) => queryClient.setQueryData(WINDOW_STATE_QUERY_KEY, next))
        .catch(() => undefined),
    close: () => void ipc.window.close().catch(() => undefined),
  };
}
