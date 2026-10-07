import { useCallback, useMemo } from "react";
import type { PillTab } from "../../../components/PillTabs";
import { usePreferencesRoute } from "../../../app/navigation";
import { useConnectionActions } from "../../../app/connection";
import { LIST_TABS } from "../constants";
import { LIST_TAB_LABELS } from "../labels";
import type { ListStateAction } from "../list-view";
import { useProjectSearch } from "./use-project-search";
import { useProjectsList } from "./use-projects-list";

interface Options {
  onAsk(id?: string): void;
  onCreate(): void;
}

export function useProjectsListPage({ onAsk, onCreate }: Options) {
  const list = useProjectsList();
  const search = useProjectSearch(list.setQuery);
  const connection = useConnectionActions();
  const { openPreferences } = usePreferencesRoute();

  const tabs = useMemo<PillTab[]>(
    () => LIST_TABS.map((id) => ({ id, label: LIST_TAB_LABELS[id], count: list.view.counts[id] })),
    [list.view.counts],
  );

  const onAction = useCallback(
    (action: ListStateAction) => {
      if (action === "preferences") openPreferences();
      else if (action === "retry") connection.refresh();
      else if (action === "create") onCreate();
      else if (action === "ask") onAsk();
      else search.clear();
    },
    [openPreferences, connection, onCreate, onAsk, search],
  );

  return { list, search, tabs, onAction };
}
