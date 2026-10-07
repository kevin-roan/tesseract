import { useMemo } from "react";
import { bulkActions, filterRuns, followUpIds, listPlaceholder } from "../model";
import { useAgentsUi } from "../store";
import { useAgentDetails } from "./use-agent-details";
import { useAgentProjects, useAgentRuns, useArchivedRuns } from "./use-agent-runs";

export function useConversationList() {
  const filter = useAgentsUi((state) => state.filter);
  const query = useAgentsUi((state) => state.query);
  const archivedView = filter === "archived";
  const { runs } = useAgentRuns();
  const archived = useArchivedRuns(archivedView, true);
  const details = useAgentDetails();
  const { names, badges, projects } = useAgentProjects();

  return useMemo(() => {
    const source = archivedView ? archived.runs : runs;
    const visible = filterRuns(source, archivedView ? "all" : filter, query, names, details.attention);
    const cards = filter === "running" || archivedView ? [] : details.cards;
    const terminals = filter === "all" ? details.terminals : [];
    return {
      filter,
      archivedView,
      runs,
      archivedRuns: archived.runs,
      source,
      visible,
      followUps: followUpIds(source ?? []),
      cards,
      terminals,
      names,
      badges,
      projects,
      bulk: bulkActions(runs, archived.runs, archivedView),
      placeholder: listPlaceholder({
        runs: source,
        visible: visible.length,
        archivedView,
        attentionCount: cards.length,
        terminalCount: terminals.length,
      }),
    };
  }, [archivedView, archived.runs, runs, filter, query, names, badges, projects, details]);
}

export type ConversationListModel = ReturnType<typeof useConversationList>;
