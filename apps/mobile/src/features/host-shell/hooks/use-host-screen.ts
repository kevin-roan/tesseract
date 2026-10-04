import { useCallback, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import type { HeaderAction } from "@/components/screen-header";
import { useQrScanner } from "@/features/sandbox/hooks/use-qr-scanner";
import { draftFromSearchParams } from "@/features/sandbox/utils/pairing";
import type { PairingDraft } from "@/features/sandbox/types";
import { confirm } from "@/lib/confirm";

import { useHostSessionStore } from "../store/host-session-store";
import { useHostStore } from "../store/host-store";
import type { HostScreenMode } from "../types";
import { HOST_ACTIONS, HOST_SCREEN, UNPAIR_CONFIRM } from "../utils/content";
import { describeHostError, hostIssueFor } from "../utils/errors";
import { formatCountdown, sessionRemainingMs } from "../utils/session";
import { useHostClient } from "./use-host-client";
import { useHostNavigation } from "./use-host-navigation";
import { useHostPairing } from "./use-host-pairing";
import { useHostTerminals } from "./use-host-terminals";
import { useHostUnlock } from "./use-host-unlock";
import { useNow } from "./use-now";

type LinkParams = { url?: string; token?: string; name?: string };

function screenMode(hydrated: boolean, paired: boolean, repairing: boolean, unlocked: boolean): HostScreenMode {
  if (!hydrated) return "loading";
  if (!paired || repairing) return "setup";
  return unlocked ? "unlocked" : "locked";
}

export function useHostScreen() {
  const nav = useHostNavigation();
  const params = useLocalSearchParams<LinkParams>();
  const [initial] = useState<PairingDraft | null>(() => draftFromSearchParams(params));
  const [repairing, setRepairing] = useState(Boolean(initial?.token));
  const { host, hydrated, client, session } = useHostClient();
  const unpairHost = useHostStore((state) => state.unpair);
  const clearSession = useHostSessionStore((state) => state.clear);

  const stopRepairing = useCallback(() => setRepairing(false), []);
  const pairing = useHostPairing(initial, stopRepairing);
  const scanner = useQrScanner(pairing.onCode, pairing.status === "validating");

  const mode = screenMode(hydrated, host !== null, repairing, session !== null);
  const unlock = useHostUnlock(mode === "locked");
  const shells = useHostTerminals();
  const now = useNow(mode === "unlocked");
  const issue = hostIssueFor(unlock.statusError);

  const lock = useCallback(() => {
    const current = session;
    clearSession();
    if (client && current) client.lock(current.session).catch(() => undefined);
  }, [client, session, clearSession]);

  const unpair = useCallback(async () => {
    if (!(await confirm(UNPAIR_CONFIRM))) return;
    lock();
    await unpairHost();
    setRepairing(false);
  }, [lock, unpairHost]);

  const { mutate: createShell } = shells.create;
  const newShell = useCallback(() => createShell(undefined, { onSuccess: (terminal) => nav.terminal(terminal.id) }), [createShell, nav]);

  const headerActions = useMemo<HeaderAction[]>(() => {
    if (mode === "unlocked") {
      return [
        { ...HOST_ACTIONS.lock, onPress: lock },
        { ...HOST_ACTIONS.unpair, onPress: () => void unpair() },
      ];
    }
    if (mode === "locked") return [{ ...HOST_ACTIONS.unpair, onPress: () => void unpair() }];
    return [];
  }, [mode, lock, unpair]);

  const subtitle = mode === "setup" ? HOST_SCREEN.setupSubtitle : mode === "locked" ? HOST_SCREEN.lockedSubtitle : host?.name;
  const shellError = shells.create.error ?? shells.close.error ?? shells.terminals.error;

  return {
    nav,
    mode,
    host,
    subtitle,
    headerActions,
    fromLink: Boolean(initial?.token) && repairing,
    pairing,
    scanner,
    unlock,
    issue,
    repair: () => setRepairing(true),
    sessionChip: HOST_SCREEN.sessionChip(formatCountdown(sessionRemainingMs(session, now))),
    shells: {
      list: shells.terminals.data ?? [],
      loading: shells.terminals.isLoading,
      error: shellError ? describeHostError(shellError) : null,
      creating: shells.create.isPending,
      closingId: shells.close.isPending ? shells.close.variables : null,
      open: nav.terminal,
      create: newShell,
      close: (id: string) => shells.close.mutate(id),
      refresh: () => void shells.terminals.refetch(),
    },
  };
}
