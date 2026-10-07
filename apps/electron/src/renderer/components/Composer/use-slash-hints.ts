import { useMemo, useState } from "react";
import { SLASH_HINT_LIMIT } from "./constants";
import { completeSlashCommand, matchSlashCommands, type SlashCommand, wrapIndex } from "./model";

export interface SlashHints {
  matches: SlashCommand[];
  open: boolean;
  activeIndex: number;
  move(delta: number): void;
  accept(index?: number): string | null;
  dismiss(): void;
}

export function useSlashHints(text: string, commands: readonly SlashCommand[] | undefined): SlashHints {
  const [cursor, setCursor] = useState({ text, index: 0, dismissed: false });
  const state = cursor.text === text ? cursor : { text, index: 0, dismissed: false };
  const matches = useMemo(() => matchSlashCommands(text, commands ?? [], SLASH_HINT_LIMIT), [text, commands]);
  const open = matches.length > 0 && !state.dismissed;
  const activeIndex = wrapIndex(state.index, matches.length);
  return {
    matches,
    open,
    activeIndex,
    move: (delta) => setCursor({ ...state, index: wrapIndex(activeIndex + delta, matches.length) }),
    accept: (index = activeIndex) => {
      const match = matches[index];
      return match ? completeSlashCommand(match) : null;
    },
    dismiss: () => setCursor({ ...state, dismissed: true }),
  };
}
