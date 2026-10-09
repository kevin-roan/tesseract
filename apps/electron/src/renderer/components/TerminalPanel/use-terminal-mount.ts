import { useEffect, useRef } from "react";
import type { TerminalHost } from "../../features/terminals/xterm-host";
import { useAccelGuardWhileFocused } from "../AccelGuard";

export function useTerminalMount(host: TerminalHost | null) {
  const ref = useRef<HTMLDivElement>(null);
  useAccelGuardWhileFocused(ref);

  useEffect(() => {
    const element = ref.current;
    if (!element || !host) return undefined;
    host.mount(element);
    host.focus();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => host.refit());
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      host.unmount();
    };
  }, [host]);

  return ref;
}
