import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AppSettings } from "../../shared/contracts/app";
import { DEFAULT_SETTINGS } from "../../shared/defaults";
import { ipc } from "../lib/ipc";
import { DATA_KEYS } from "./data";

export function useSettings(): AppSettings {
  const queryClient = useQueryClient();
  useEffect(() => ipc.app.on("settings", (settings) => queryClient.setQueryData(DATA_KEYS.settings, settings)), [queryClient]);
  const query = useQuery({ queryKey: DATA_KEYS.settings, queryFn: () => ipc.app.settings(), staleTime: Infinity });
  return query.data ?? DEFAULT_SETTINGS;
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => ipc.app.updateSettings(patch),
    onSuccess: (settings) => queryClient.setQueryData(DATA_KEYS.settings, settings),
  });
}
