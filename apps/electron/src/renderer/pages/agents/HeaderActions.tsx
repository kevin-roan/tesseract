import { useMemo, useRef } from "react";
import { ActionMenu, Floating, MenuItem, useActionMenu, type MenuSections } from "../../components/ActionMenu";
import { IconButton } from "../../components/IconButton";
import { AGENT_FILTERS } from "../../features/agents/constants";
import { useAgentRuns, useArchivedRuns } from "../../features/agents/hooks/use-agent-runs";
import { useRunActions } from "../../features/agents/hooks/use-run-actions";
import { FILTER_LABELS, LIST_LABELS, MANAGE_LABELS } from "../../features/agents/labels";
import { bulkActions } from "../../features/agents/model";
import { useAgentsUi } from "../../features/agents/store";
import styles from "./AgentsPage.module.css";

export function HeaderActions() {
  const ui = useAgentsUi();
  const archivedView = ui.filter === "archived";
  const { runs } = useAgentRuns();
  const archived = useArchivedRuns(archivedView);
  const actions = useRunActions();
  const filterMenu = useActionMenu();
  const manageMenu = useActionMenu();
  const filterRef = useRef<HTMLSpanElement | null>(null);
  const manageRef = useRef<HTMLSpanElement | null>(null);

  const sections = useMemo<MenuSections>(() => {
    const available = bulkActions(runs, archived.runs, archivedView);
    if (available.includes("empty_archive"))
      return [[{ id: "empty", label: MANAGE_LABELS.emptyArchive, danger: true, onSelect: () => actions.requestEmptyArchive(archived.runs) }]];
    if (available.length === 0) return [];
    return [
      [{ id: "archive-all", label: MANAGE_LABELS.archiveAll, onSelect: () => void actions.archiveAllFinished(runs) }],
      [{ id: "delete-all", label: MANAGE_LABELS.deleteAll, danger: true, onSelect: () => actions.requestDeleteAllFinished(runs) }],
    ];
  }, [runs, archived.runs, archivedView, actions]);

  return (
    <div className={styles.headerActions}>
      <IconButton icon="search" label={LIST_LABELS.searchToggle} checked={ui.searchOpen} onClick={() => ui.setSearchOpen(!ui.searchOpen)} />
      <span ref={filterRef} className={styles.anchor}>
        <IconButton
          icon="filter"
          label={LIST_LABELS.filter}
          aria-haspopup="menu"
          aria-expanded={filterMenu.open}
          checked={filterMenu.open}
          onClick={(event) => (filterMenu.open ? filterMenu.close() : filterMenu.openBelow(event.currentTarget))}
        />
      </span>
      <Floating open={filterMenu.open} anchor={filterMenu.anchor} onClose={filterMenu.close} ariaLabel={LIST_LABELS.filter} ignoreRef={filterRef}>
        {AGENT_FILTERS.map((filter) => (
          <MenuItem
            key={filter}
            role="menuitemradio"
            aria-checked={ui.filter === filter}
            label={FILTER_LABELS[filter]}
            selected={ui.filter === filter}
            showCheck
            onClick={() => {
              filterMenu.close();
              ui.setFilter(filter);
            }}
          />
        ))}
      </Floating>
      <span ref={manageRef} className={styles.anchor}>
        <IconButton
          icon="more"
          label={MANAGE_LABELS.more}
          aria-haspopup="menu"
          aria-expanded={manageMenu.open}
          checked={manageMenu.open}
          disabled={sections.length === 0}
          onClick={(event) => (manageMenu.open ? manageMenu.close() : manageMenu.openBelow(event.currentTarget))}
        />
      </span>
      <ActionMenu anchor={manageMenu.anchor} sections={sections} onClose={manageMenu.close} ariaLabel={MANAGE_LABELS.more} ignoreRef={manageRef} />
      <IconButton icon="compose" label={LIST_LABELS.new} onClick={() => ui.openNew()} />
      <IconButton icon="sidebar" label={LIST_LABELS.toggle} checked={ui.sidebarOpen} onClick={() => ui.setSidebarOpen(!ui.sidebarOpen)} />
    </div>
  );
}
