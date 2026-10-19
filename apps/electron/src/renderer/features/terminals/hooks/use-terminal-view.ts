import { useEffect, useRef } from "react";
import { useAccelGuardWhileFocused } from "../../../components/AccelGuard";
import { useTerminalsScope } from "../scope";

export function useTerminalView(id: string, visible: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const { sessions } = useTerminalsScope();
  useAccelGuardWhileFocused(ref);

  useEffect(() => {
    const element = ref.current;
    const session = sessions.get(id);
    if (!element || !session) return undefined;
    session.host.mount(element);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => session.host.refit());
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      session.host.unmount();
    };
  }, [id, sessions]);

  useEffect(() => {
    if (!visible) return;
    const session = sessions.get(id);
    session?.host.refit();
    session?.host.focus();
  }, [id, visible, sessions]);

  return ref;
}
