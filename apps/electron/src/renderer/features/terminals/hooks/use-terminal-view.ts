import { useEffect, useRef } from "react";
import { useAccelGuardWhileFocused } from "../../../components/AccelGuard";
import { terminalSessions } from "../sessions";

export function useTerminalView(id: string, visible: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useAccelGuardWhileFocused(ref);

  useEffect(() => {
    const element = ref.current;
    const session = terminalSessions.get(id);
    if (!element || !session) return undefined;
    session.host.mount(element);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => session.host.refit());
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      session.host.unmount();
    };
  }, [id]);

  useEffect(() => {
    if (!visible) return;
    const session = terminalSessions.get(id);
    session?.host.refit();
    session?.host.focus();
  }, [id, visible]);

  return ref;
}
