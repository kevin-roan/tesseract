import { elapsedSeconds, pluralize } from "@/features/sandbox/utils/format";
import { formatTokens } from "@/features/home/utils/tokens";

import type { IslandState } from "@/modules/theone-island";

import { ISLAND_CHAT_ROW_HEIGHT, ISLAND_CHAT_ROWS_MAX, ISLAND_PANEL_HEIGHT } from "./constants";
import { liveCount } from "./state";

export type IslandSummary = {
  /** The one short value the capsule shows. */
  value: string;
  /** Big figure in the middle of the panel. */
  headline: string;
  /** One line under the headline. */
  caption: string;
  /** How many more live items sit behind the primary one. */
  more: number;
  /** Title of the item Stop and the headline act on, or `null` when nothing runs. */
  primary: string | null;
  live: boolean;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Stopwatch reading since `startedAt`: "04:05" under an hour, "1:02:03" past it. */
export function clockLabel(startedAt: string, now: number): string {
  const seconds = Math.floor(elapsedSeconds(startedAt, null, now) ?? 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/** Running chats besides the one the headline shows, as many as the panel lists. */
export function otherChats(runs: IslandState["runs"]): IslandState["runs"] {
  return runs.slice(1, 1 + ISLAND_CHAT_ROWS_MAX);
}

export function islandPanelHeight(chatRows: number): number {
  return ISLAND_PANEL_HEIGHT + chatRows * ISLAND_CHAT_ROW_HEIGHT;
}

export function tokensTodayLabel(tokens: number): string {
  return `${formatTokens(tokens)} today`;
}

export function liveCountLabel(count: number): string {
  return pluralize(count, "task");
}

export function capsuleTitle(runs: number, commands: number, sharedItems: number, hasDraft: boolean): string {
  if (runs > 0) return runs === 1 ? "Claude is working" : `${runs} Claude runs`;
  if (commands > 0) return commands === 1 ? "Command running" : `${commands} commands running`;
  if (sharedItems > 0) return pluralize(sharedItems, "shared item");
  if (hasDraft) return "Draft ready";
  return "Idle";
}

export function islandSummary(
  state: Pick<IslandState, "runs" | "commands">,
  sharedItems: number,
  hasDraft: boolean,
  now: number,
): IslandSummary {
  const count = liveCount(state);
  const more = Math.max(0, count - 1);
  const [run] = state.runs;
  const [command] = state.commands;
  if (run) {
    const clock = clockLabel(run.startedAt, now);
    return { value: count > 1 ? liveCountLabel(count) : clock, headline: clock, caption: run.title, more, primary: run.title, live: true };
  }
  if (command) {
    return {
      value: count > 1 ? liveCountLabel(count) : command.label,
      headline: command.label,
      caption: command.project ?? "Running",
      more,
      primary: command.label,
      live: true,
    };
  }
  if (sharedItems > 0) {
    return { value: `${sharedItems} shared`, headline: String(sharedItems), caption: sharedItems === 1 ? "Shared item" : "Shared items", more, primary: null, live: false };
  }
  if (hasDraft) return { value: "Draft", headline: "Draft", caption: "Ready to attach", more, primary: null, live: false };
  return { value: "Idle", headline: "Idle", caption: "Nothing running", more, primary: null, live: false };
}
