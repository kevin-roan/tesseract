import { useCallback, type MouseEvent } from "react";
import { useActionMenu } from "../../../components/ActionMenu";
import { terminalSessions } from "../sessions";

export function useTerminalContextMenu() {
  const menu = useActionMenu();
  const { openAt } = menu;
  const onContextMenu = useCallback(
    (id: string, event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      if (event.shiftKey || !terminalSessions.get(id)?.host.mouseTracking()) openAt({ x: event.clientX, y: event.clientY });
    },
    [openAt],
  );
  return { anchor: menu.anchor, close: menu.close, onContextMenu };
}
