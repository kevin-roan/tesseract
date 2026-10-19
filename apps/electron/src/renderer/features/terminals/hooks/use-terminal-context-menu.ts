import { useCallback, type MouseEvent } from "react";
import { useActionMenu } from "../../../components/ActionMenu";
import { useTerminalsScope } from "../scope";

export function useTerminalContextMenu() {
  const menu = useActionMenu();
  const { sessions } = useTerminalsScope();
  const { openAt } = menu;
  const onContextMenu = useCallback(
    (id: string, event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      if (event.shiftKey || !sessions.get(id)?.host.mouseTracking()) openAt({ x: event.clientX, y: event.clientY });
    },
    [openAt, sessions],
  );
  return { anchor: menu.anchor, close: menu.close, onContextMenu };
}
