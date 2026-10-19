import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSavedMachines } from "../../../app/connection";
import { MACHINE_SCOPED_QUERY_KEYS } from "../constants";
import { activeMachine } from "../model";

export function useMachineScopeRefresh(): void {
  const queryClient = useQueryClient();
  const activeId = activeMachine(useSavedMachines())?.id ?? null;
  const previous = useRef(activeId);
  useEffect(() => {
    if (previous.current === activeId) return;
    previous.current = activeId;
    for (const queryKey of MACHINE_SCOPED_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey });
  }, [activeId, queryClient]);
}
