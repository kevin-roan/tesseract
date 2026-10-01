import { elapsedSeconds, formatDuration, pluralize } from "@/features/sandbox/utils/format";
import { formatTokens } from "@/features/home/utils/tokens";

export function elapsedLabel(startedAt: string, now: number): string {
  const seconds = elapsedSeconds(startedAt, null, now);
  return seconds === null ? "" : formatDuration(seconds);
}

export function tokensLabel(tokens: number | null): string | null {
  return tokens === null ? null : `${formatTokens(tokens)} tok`;
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
