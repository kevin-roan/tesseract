import { randomInt } from "node:crypto";

export const PSEUDONYM_ADJECTIVES = [
  "amber", "autumn", "bold", "brave", "breezy", "bright", "calm", "clever", "cosmic", "cozy",
  "crisp", "dapper", "dawn", "dusky", "eager", "early", "fancy", "fluffy", "frosty", "gentle",
  "giddy", "glad", "golden", "grand", "happy", "hazy", "humble", "jolly", "keen", "kind",
  "lively", "lucky", "lunar", "mellow", "merry", "misty", "morning", "mossy", "nimble", "noble",
  "olive", "patient", "plucky", "polite", "proud", "quick", "quiet", "rapid", "rosy", "rustic",
  "sandy", "silent", "silver", "sleepy", "snowy", "solar", "sunny", "swift", "tidy", "velvet",
  "vivid", "warm", "wild", "windy", "witty", "zesty",
] as const;

export const PSEUDONYM_NOUNS = [
  "acorn", "badger", "beacon", "birch", "bison", "brook", "canyon", "cat", "cedar", "comet",
  "coral", "crane", "creek", "dolphin", "dove", "falcon", "fern", "finch", "fox", "gecko",
  "harbor", "hare", "hazel", "heron", "hill", "island", "koala", "lagoon", "lark", "lemur",
  "lotus", "lynx", "maple", "meadow", "meteor", "moose", "moth", "newt", "oak", "orca",
  "otter", "owl", "panda", "pebble", "pine", "plover", "pond", "puffin", "quail", "raven",
  "reef", "river", "robin", "sparrow", "spruce", "stone", "swan", "thistle", "tiger", "trout",
  "tulip", "walrus", "willow", "wren", "yak", "zebra",
] as const;

export type RandomIndex = (bound: number) => number;

export function pseudonym(taken: Iterable<string> = [], random: RandomIndex = randomInt): string {
  const used = new Set(taken);
  const pairs = PSEUDONYM_ADJECTIVES.flatMap((adjective) => PSEUDONYM_NOUNS.map((noun) => `${adjective}-${noun}`));
  for (let index = pairs.length - 1; index > 0; index -= 1) {
    const other = random(index + 1);
    [pairs[index], pairs[other]] = [pairs[other] as string, pairs[index] as string];
  }
  const free = pairs.find((pair) => !used.has(pair));
  if (free !== undefined) return free;
  let suffix = 2;
  while (used.has(`${pairs[0]}-${suffix}`)) suffix += 1;
  return `${pairs[0]}-${suffix}`;
}
