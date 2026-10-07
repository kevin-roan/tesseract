import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { WindowState } from "../../../shared/contracts/window";
import { ipc } from "../../lib/ipc";

const WINDOW_KEY = ["window", "state"] as const;
const FALLBACK: WindowState = { maximized: false, fullscreen: false, focused: true, visible: true, zoom: 1, systemDark: true };

export function useWindowState(): WindowState {
  const queryClient = useQueryClient();
  useEffect(() => ipc.window.on("state", (state) => queryClient.setQueryData(WINDOW_KEY, state)), [queryClient]);
  return useQuery({ queryKey: WINDOW_KEY, queryFn: () => ipc.window.state(), staleTime: Infinity }).data ?? FALLBACK;
}
