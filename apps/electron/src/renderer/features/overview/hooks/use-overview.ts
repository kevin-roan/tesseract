import { useCallback, useMemo } from "react";
import { useConnection, useConnectionActions, useConnectionView } from "../../../app/connection";
import { useNavigateTo, usePreferencesRoute } from "../../../app/navigation";
import { INBOX_TARGET, type CountTarget, type EmptyAction } from "../constants";
import { attentionNotice, countItems, displayRows, emptyModel, overviewMeta, overviewTitle, resourceItems, toolRows } from "../model";

export function useOverview() {
  const state = useConnection();
  const view = useConnectionView();
  const actions = useConnectionActions();
  const navigate = useNavigateTo();
  const { openPreferences } = usePreferencesRoute();
  const status = state.sandbox;

  const content = useMemo(
    () =>
      status
        ? {
            resources: resourceItems(status),
            activity: countItems(status),
            display: displayRows(status),
            tools: toolRows(status),
          }
        : null,
    [status],
  );

  const openTarget = useCallback((target: CountTarget) => navigate(target.page, target.params), [navigate]);

  const runAction = useCallback(
    (action: EmptyAction) => {
      if (action === "retry") actions.refresh();
      else if (action === "rediscover") void actions.rediscover().catch(() => undefined);
      else openPreferences();
    },
    [actions, openPreferences],
  );

  return {
    title: overviewTitle(status, state),
    meta: overviewMeta(status),
    badge: { label: view.label, tone: view.tone },
    empty: status ? null : emptyModel(state),
    notice: attentionNotice(state.inbox),
    content,
    refresh: actions.refresh,
    openInbox: useCallback(() => openTarget(INBOX_TARGET), [openTarget]),
    openTarget,
    runAction,
  };
}

export type OverviewModel = ReturnType<typeof useOverview>;
