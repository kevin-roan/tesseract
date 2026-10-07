import { useQuery } from "@tanstack/react-query";
import { ipc } from "../../../lib/ipc";
import { SANDBOX_QUERY_KEYS } from "../constants";

export function useExistingSandbox() {
  return useQuery({
    queryKey: SANDBOX_QUERY_KEYS.existing,
    queryFn: () => ipc.sandbox.existing(),
    retry: false,
    staleTime: Infinity,
  });
}

export function useSandboxDefaults() {
  return useQuery({
    queryKey: SANDBOX_QUERY_KEYS.defaults,
    queryFn: () => ipc.sandbox.defaults(),
    retry: false,
    staleTime: Infinity,
  });
}
