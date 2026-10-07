import { FUZZY_MIN_SPREAD, FUZZY_SPREAD_FACTOR, MATCH_SCORE, PALETTE_RESULT_LIMIT } from "./constants";
import type { MatchRange, PaletteCommand, PaletteResult, PaletteSection } from "./types";

interface TextMatch {
  score: number;
  ranges: MatchRange[];
}

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

function isWordStart(text: string, index: number): boolean {
  return index === 0 || !isWordChar(text[index - 1]);
}

function fuzzyMatch(text: string, query: string): TextMatch | null {
  const indices: number[] = [];
  let from = 0;
  for (const char of query) {
    if (char === " ") continue;
    let found = -1;
    for (let index = from; index < text.length; index += 1) {
      if (text[index] !== char) continue;
      if (found === -1) found = index;
      if (isWordStart(text, index)) {
        found = index;
        break;
      }
    }
    if (found === -1) return null;
    indices.push(found);
    from = found + 1;
  }
  if (indices.length === 0) return null;
  const spread = indices[indices.length - 1]! - indices[0]!;
  if (!isWordStart(text, indices[0]!) || spread > Math.max(query.length * FUZZY_SPREAD_FACTOR, FUZZY_MIN_SPREAD)) return null;
  const ranges: [number, number][] = [];
  for (const index of indices) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else ranges.push([index, index + 1]);
  }
  const starts = indices.filter((index) => isWordStart(text, index)).length;
  return { score: MATCH_SCORE.fuzzy + starts * 10 - spread - ranges.length * 5, ranges };
}

export function matchText(text: string, query: string): TextMatch | null {
  const haystack = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return { score: 0, ranges: [] };
  const whole: MatchRange[] = [[0, needle.length]];
  if (haystack === needle) return { score: MATCH_SCORE.exact, ranges: whole };
  if (haystack.startsWith(needle)) return { score: MATCH_SCORE.prefix - (haystack.length - needle.length), ranges: whole };
  const first = haystack.indexOf(needle);
  let index = first;
  while (index !== -1) {
    if (isWordStart(haystack, index)) {
      return { score: MATCH_SCORE.wordPrefix - index, ranges: [[index, index + needle.length]] };
    }
    index = haystack.indexOf(needle, index + 1);
  }
  if (first !== -1) return { score: MATCH_SCORE.substring - first, ranges: [[first, first + needle.length]] };
  return fuzzyMatch(haystack, needle);
}

function termsMatch(text: string, terms: string[]): TextMatch | null {
  const ranges: MatchRange[] = [];
  let score = 0;
  for (const term of terms) {
    const match = matchText(text, term);
    if (!match || match.score < MATCH_SCORE.fuzzy * 2) return null;
    score += match.score;
    ranges.push(...match.ranges);
  }
  return { score: score / terms.length - 1, ranges: mergeRanges(ranges) };
}

export function mergeRanges(ranges: readonly MatchRange[]): MatchRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

export function scoreCommand(command: PaletteCommand, query: string): PaletteResult | null {
  const trimmed = query.trim();
  if (!trimmed) return { command, score: 0, ranges: [] };
  const title = matchText(command.title, trimmed);
  if (title) return { command, score: title.score, ranges: title.ranges };
  const terms = trimmed.split(/\s+/);
  if (terms.length > 1) {
    const split = termsMatch(command.title, terms);
    if (split) return { command, score: split.score, ranges: split.ranges };
  }
  const needle = trimmed.toLowerCase();
  if (command.keywords?.some((keyword) => keyword.toLowerCase().startsWith(needle))) {
    return { command, score: MATCH_SCORE.keyword, ranges: [] };
  }
  if (command.subtitle?.toLowerCase().includes(needle)) return { command, score: MATCH_SCORE.subtitle, ranges: [] };
  return null;
}

function groupResults(results: PaletteResult[], groupOrder: readonly string[]): PaletteSection[] {
  const sections = new Map<string, PaletteResult[]>();
  for (const result of results) {
    const list = sections.get(result.command.group) ?? [];
    list.push(result);
    sections.set(result.command.group, list);
  }
  const rank = (group: string) => {
    const index = groupOrder.indexOf(group);
    return index === -1 ? groupOrder.length : index;
  };
  return [...sections.entries()]
    .map(([group, list]) => ({ group, results: list }))
    .sort((a, b) => rank(a.group) - rank(b.group));
}

export interface SearchOptions {
  recent?: readonly string[];
  recentGroup?: string;
  groupOrder?: readonly string[];
  limit?: number;
}

export function searchCommands(commands: readonly PaletteCommand[], query: string, options: SearchOptions = {}): PaletteSection[] {
  const { recent = [], recentGroup, groupOrder = [], limit = PALETTE_RESULT_LIMIT } = options;
  if (!query.trim()) {
    const byId = new Map(commands.map((command) => [command.id, command]));
    const recentCommands = recentGroup
      ? recent.map((id) => byId.get(id)).filter((command): command is PaletteCommand => command !== undefined)
      : [];
    const recentIds = new Set(recentCommands.map((command) => command.id));
    const rest = commands.filter((command) => !recentIds.has(command.id)).map((command) => ({ command, score: 0, ranges: [] }));
    const sections = groupResults(rest, groupOrder);
    return recentCommands.length > 0 && recentGroup
      ? [{ group: recentGroup, results: recentCommands.map((command) => ({ command, score: 0, ranges: [] })) }, ...sections]
      : sections;
  }
  const scored = commands
    .map((command, index) => ({ result: scoreCommand(command, query), index }))
    .filter((entry): entry is { result: PaletteResult; index: number } => entry.result !== null)
    .sort((a, b) => b.result.score - a.result.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.result);
  const sections = new Map<string, PaletteResult[]>();
  for (const result of scored) {
    const list = sections.get(result.command.group) ?? [];
    list.push(result);
    sections.set(result.command.group, list);
  }
  return [...sections.entries()].map(([group, results]) => ({ group, results }));
}

export function flattenSections(sections: readonly PaletteSection[]): PaletteResult[] {
  return sections.flatMap((section) => section.results);
}

export interface TextSegment {
  text: string;
  match: boolean;
}

export function highlightSegments(text: string, ranges: readonly MatchRange[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const [start, end] of mergeRanges(ranges)) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
    if (end > start) segments.push({ text: text.slice(start, end), match: true });
    cursor = Math.max(cursor, end);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}
