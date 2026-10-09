import type { Tone } from "../../theme/colors";
import { SIDEBAR } from "./constants";

export type SidebarProjectsState = "loading" | "offline" | "empty" | "ready";

export interface SidebarRunItem {
  id: string;
  title: string;
  tone: Tone;
  running: boolean;
  time?: string;
}

export interface SidebarProjectItem {
  id: string | null;
  name: string;
  tint: number | null;
  confidential?: boolean;
  running: number;
  runs: readonly SidebarRunItem[];
}

export function runTitle(prompt: string | null | undefined, fallback: string, maxChars: number = SIDEBAR.runTitleMaxChars): string {
  const line = (prompt ?? "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  if (!line) return fallback;
  return line.length > maxChars ? `${line.slice(0, maxChars).trimEnd()}…` : line;
}

export function runTone(state: string | null | undefined): Tone {
  switch (state) {
    case "running":
      return "info";
    case "succeeded":
      return "success";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function countLabel(count: number | null | undefined, max: number = SIDEBAR.countMax): string | null {
  if (!count || count <= 0) return null;
  return count > max ? `${max}+` : String(count);
}

export function workspaceState(online: boolean, loaded: boolean, itemCount: number): SidebarProjectsState {
  if (itemCount > 0) return "ready";
  if (!loaded) return online ? "loading" : "offline";
  return online ? "empty" : "offline";
}

export function projectKey(id: string | null): string {
  return id ?? SIDEBAR.unassignedKey;
}

export interface ExpansionState {
  toggled: Readonly<Record<string, boolean>>;
  auto: Readonly<Record<string, true>>;
}

export const EMPTY_EXPANSION: ExpansionState = { toggled: {}, auto: {} };

export function withActiveProjects(state: ExpansionState, items: readonly Pick<SidebarProjectItem, "id" | "running">[]): ExpansionState {
  const added = items.map((item) => projectKey(item.id)).filter((key, index) => items[index]!.running > 0 && !state.auto[key]);
  if (added.length === 0) return state;
  const auto = { ...state.auto };
  for (const key of added) auto[key] = true;
  return { ...state, auto };
}

export function isExpanded(state: ExpansionState, id: string | null): boolean {
  const key = projectKey(id);
  return state.toggled[key] ?? Boolean(state.auto[key]);
}

export function toggleExpansion(state: ExpansionState, id: string | null): ExpansionState {
  const key = projectKey(id);
  return { ...state, toggled: { ...state.toggled, [key]: !isExpanded(state, id) } };
}

export type SidebarContainersState = "loading" | "unavailable" | "empty" | "ready";

export type SidebarContainerActivity = "running" | "busy" | "stopped" | "error";

export interface SidebarContainerItem {
  name: string;
  activity: SidebarContainerActivity;
  status: string;
}
