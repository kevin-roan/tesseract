import { useEffect } from "react";
import { useToastStore } from "./store";
import { useToastTimer } from "./use-toast-timer";

export function useToastHost(scope: string) {
  const current = useToastStore((state) => state.queue.find((item) => item.scope === scope));
  const dismiss = useToastStore((state) => state.dismiss);
  const dropScope = useToastStore((state) => state.dropScope);
  const timer = useToastTimer(current?.id ?? null, current?.timeoutMs ?? 0, dismiss);

  useEffect(() => () => dropScope(scope), [scope, dropScope]);

  return { current, dismiss, timer };
}
