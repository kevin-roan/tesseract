import type { AgentRun, BuildJob, ProcessInfo, Project } from "@tesseract/protocol";
import type { ConnectionStatus } from "../../app/connection";
import type { IconName } from "../../theme/icons";
import { LIST_TABS, PROJECTS_ICONS } from "./constants";
import { CONNECTION_ACTION_LABELS, CONNECTION_STATE_LABELS, ERROR_PLACEHOLDER, GROUP_LABELS, LIST_TAB_LABELS, PROJECTS_LABELS } from "./labels";
import { cardModel, groupByActivity, inTab, matches, sortProjects } from "./model";
import type { CardGroup, ListTab } from "./types";

export type ListStateAction = "preferences" | "retry" | "create" | "ask" | "clearSearch";

export interface ListStateView {
  title: string;
  message: string | null;
  icon: IconName | null;
  loading: boolean;
  action: { id: ListStateAction; label: string } | null;
  secondary: { id: ListStateAction; label: string } | null;
}

export interface ListInput {
  projects: readonly Project[] | null;
  processes: readonly ProcessInfo[];
  builds: readonly BuildJob[];
  runs: readonly AgentRun[];
  status: ConnectionStatus;
  errorMessage: string | null;
  query: string;
  tab: ListTab;
  grouped: boolean;
  now: number;
}

export interface ListView {
  state: ListStateView | null;
  counts: Record<ListTab, number>;
  groups: CardGroup[];
  grouped: boolean;
  noMatch: ListStateView | null;
}

const spinner = (title: string): ListStateView => ({ title, message: null, icon: null, loading: true, action: null, secondary: null });

export function connectionState(status: ConnectionStatus, errorMessage: string | null): ListStateView {
  if (status === "online") return spinner(PROJECTS_LABELS.loading);
  const entry = CONNECTION_STATE_LABELS[status] ?? CONNECTION_STATE_LABELS.connecting;
  if (!entry.action) return spinner(entry.title);
  const message = entry.message ? entry.message.replace(ERROR_PLACEHOLDER, errorMessage ?? "") : null;
  return {
    title: entry.title,
    message: message || null,
    icon: PROJECTS_ICONS.offline,
    loading: false,
    action: { id: entry.action, label: CONNECTION_ACTION_LABELS[entry.action] },
    secondary: null,
  };
}

export const EMPTY_LIST_STATE: ListStateView = {
  title: PROJECTS_LABELS.emptyTitle,
  message: PROJECTS_LABELS.emptyMessage,
  icon: PROJECTS_ICONS.project,
  loading: false,
  action: { id: "create", label: PROJECTS_LABELS.newProject },
  secondary: { id: "ask", label: PROJECTS_LABELS.askClaude },
};

export function noMatchState(query: string, tab: ListTab): ListStateView {
  const trimmed = query.trim();
  if (trimmed) {
    return {
      title: PROJECTS_LABELS.noMatching,
      message: PROJECTS_LABELS.nothingMatches(trimmed),
      icon: PROJECTS_ICONS.search,
      loading: false,
      action: { id: "clearSearch", label: PROJECTS_LABELS.clearSearch },
      secondary: null,
    };
  }
  return {
    title: PROJECTS_LABELS.noTabProjects(LIST_TAB_LABELS[tab].toLowerCase()),
    message: null,
    icon: PROJECTS_ICONS.project,
    loading: false,
    action: null,
    secondary: null,
  };
}

const ZERO_COUNTS: Record<ListTab, number> = { all: 0, active: 0, idle: 0 };

export function listView(input: ListInput): ListView {
  const { projects, processes, builds, runs, query, tab, grouped, now } = input;
  if (projects === null) return { state: connectionState(input.status, input.errorMessage), counts: ZERO_COUNTS, groups: [], grouped, noMatch: null };
  if (projects.length === 0) return { state: EMPTY_LIST_STATE, counts: ZERO_COUNTS, groups: [], grouped, noMatch: null };
  const filtered = sortProjects(projects.filter((project) => matches(project, query)), processes, builds, runs);
  const cards = filtered.map((project) => cardModel(project, processes, builds, runs, now));
  const counts = Object.fromEntries(LIST_TABS.map((id) => [id, cards.filter((card) => inTab(card.activity, id)).length])) as Record<ListTab, number>;
  const visible = cards.filter((card) => inTab(card.activity, tab));
  const groups: CardGroup[] = grouped ? groupByActivity(visible) : visible.length ? [{ id: "all", title: GROUP_LABELS.all, cards: visible }] : [];
  return { state: null, counts, groups, grouped, noMatch: visible.length === 0 ? noMatchState(query, tab) : null };
}
