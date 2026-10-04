import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MenuOption } from "@/components/menu-sheet";
import type { HeaderAction } from "@/components/screen-header";

import { PAGE_ACTIONS, SYNC_ACTIONS } from "../utils/actions";
import { SYNC_CHANGES_REFRESH_INTERVAL_MS } from "../utils/constants";
import { isSyncActionId, SYNC_ACTION_IDS, syncActionDetail, type SyncActionId } from "../utils/sync";
import { useSyncActions } from "./use-sync-actions";

/**
 * A "Sync" header action for a screen showing a project's work, opening a menu of the four sync actions.
 * To/from host queue at once; Revert and Discard ask first. `active` keeps the changed files fresh.
 */
export function useSyncMenu(projectId: string | null, active = false) {
  const sync = useSyncActions(projectId, active ? SYNC_CHANGES_REFRESH_INTERVAL_MS : undefined);
  const [open, setOpen] = useState(false);
  const queued = useRef<SyncActionId | null>(null);
  const { refetch } = sync.changesQuery;
  const { reasons, changes, pull, get, revert, confirmDiscard } = sync;

  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active && projectId) void refetch();
    wasActive.current = active;
  }, [active, projectId, refetch]);

  const options = useMemo<MenuOption[]>(
    () =>
      SYNC_ACTION_IDS.map((id) => ({
        id,
        label: SYNC_ACTIONS[id].label,
        icon: SYNC_ACTIONS[id].icon,
        description: syncActionDetail(id, reasons[id], changes),
        disabled: reasons[id] !== null,
      })),
    [changes, reasons],
  );

  const close = useCallback(() => setOpen(false), []);

  const select = useCallback(
    (id: string) => {
      if (!isSyncActionId(id) || reasons[id] !== null) return;
      setOpen(false);
      if (id === "pull") pull();
      else if (id === "get") get();
      else queued.current = id;
    },
    [get, pull, reasons],
  );

  /** Revert and Discard confirm with an alert, which can only open once the sheet is gone. */
  const onDismissed = useCallback(() => {
    const id = queued.current;
    queued.current = null;
    if (id === "revert") revert();
    else if (id === "discard") confirmDiscard();
  }, [confirmDiscard, revert]);

  const action = useMemo<HeaderAction | null>(
    () => (projectId ? { ...PAGE_ACTIONS.sync, onPress: () => setOpen(true), disabled: !sync.loaded } : null),
    [projectId, sync.loaded],
  );

  return {
    action,
    menu: { visible: open, options, onSelect: select, onClose: close, onDismissed },
    notice: sync.notice,
    dismiss: sync.dismiss,
  };
}

export type SyncMenuState = ReturnType<typeof useSyncMenu>;
