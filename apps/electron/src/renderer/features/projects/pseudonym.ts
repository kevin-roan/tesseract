import { PSEUDONYM_ADJECTIVES, PSEUDONYM_NOUNS } from "./constants";

export type RandomSource = () => number;

function shuffled<T>(items: T[], random: RandomSource): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [items[index], items[swap]] = [items[swap] as T, items[index] as T];
  }
  return items;
}

export function pseudonym(taken: Iterable<string> = [], random: RandomSource = Math.random): string {
  const used = new Set(taken);
  const pairs = shuffled(
    PSEUDONYM_ADJECTIVES.flatMap((adjective) => PSEUDONYM_NOUNS.map((noun) => `${adjective}-${noun}`)),
    random,
  );
  const free = pairs.find((pair) => !used.has(pair));
  if (free) return free;
  const base = pairs[0] ?? "";
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
