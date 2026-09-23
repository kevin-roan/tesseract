import { useMemo } from "react";

import type { HeaderAction } from "@/components/screen-header";

import { PAGE_ACTIONS } from "../utils/actions";
import { displayOutage, displaySubtitle } from "../utils/display";
import { describeError } from "../utils/errors";
import { OFFLINE_BADGE, pageTone, stateLabel } from "../utils/states";
import { useDisplayStatus } from "./use-sandbox-queries";
import { useWebPageSession } from "./use-web-page-session";

export function useDisplaySession() {
  const display = useDisplayStatus();
  const data = display.data;
  const outage = displayOutage(data);
  const ready = data !== undefined && outage === null;
  const session = useWebPageSession("vnc", null, (client) => client.vncPageUrl(), ready);
  const { reconnect } = session;
  const { refetch } = display;

  const headerActions = useMemo<HeaderAction[]>(
    () => [{ ...PAGE_ACTIONS.reconnect, onPress: ready ? reconnect : () => void refetch() }],
    [ready, reconnect, refetch],
  );

  return {
    session,
    headerActions,
    subtitle: displaySubtitle(data),
    badge: outage ? OFFLINE_BADGE : { label: stateLabel(session.connection), tone: pageTone(session.connection) },
    outage,
    statusError: display.error ? describeError(display.error) : null,
    statusLoading: display.isLoading,
    rechecking: display.isFetching,
    recheck: () => void refetch(),
  };
}
