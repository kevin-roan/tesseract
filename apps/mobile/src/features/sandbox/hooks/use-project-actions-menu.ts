import { useCallback, useMemo, useRef, useState } from "react";

import type { MenuOption } from "@/components/menu-sheet";
import type { HeaderAction } from "@/components/screen-header";
import { VIEWER_ICONS } from "@/features/app-runs/utils/content";

import { PROJECT_ACTIONS, PROJECT_MORE_ACTION } from "../utils/actions";

const EMULATOR_ID = "emulator";

type Emulator = { label: string; hint?: string; busy: boolean; open: () => void };

type Handlers = {
  shell: () => void;
  claudeSession: () => void;
  askClaude: () => void;
  rename: () => void;
};

/** The project screen's single "more" header action, opening a menu of everything you can start from it. */
export function useProjectActionsMenu(emulator: Emulator | null, handlers: Handlers) {
  const [open, setOpen] = useState(false);
  const queued = useRef<string | null>(null);

  const options = useMemo<MenuOption[]>(
    () => [
      ...(emulator
        ? [{ id: EMULATOR_ID, icon: VIEWER_ICONS.android, label: emulator.label, description: emulator.hint, disabled: emulator.busy }]
        : []),
      PROJECT_ACTIONS.askClaude,
      PROJECT_ACTIONS.claudeSession,
      PROJECT_ACTIONS.shell,
      PROJECT_ACTIONS.rename,
    ],
    [emulator],
  );

  const select = useCallback((id: string) => {
    queued.current = id;
    setOpen(false);
  }, []);

  /** Navigation and the rename sheet wait until the menu is gone. */
  const onDismissed = useCallback(() => {
    const id = queued.current;
    queued.current = null;
    if (id === EMULATOR_ID) emulator?.open();
    else if (id === PROJECT_ACTIONS.askClaude.id) handlers.askClaude();
    else if (id === PROJECT_ACTIONS.claudeSession.id) handlers.claudeSession();
    else if (id === PROJECT_ACTIONS.shell.id) handlers.shell();
    else if (id === PROJECT_ACTIONS.rename.id) handlers.rename();
  }, [emulator, handlers]);

  const action = useMemo<HeaderAction>(() => ({ ...PROJECT_MORE_ACTION, onPress: () => setOpen(true) }), []);

  return {
    action,
    menu: { visible: open, title: PROJECT_MORE_ACTION.label, options, onSelect: select, onClose: () => setOpen(false), onDismissed },
  };
}
