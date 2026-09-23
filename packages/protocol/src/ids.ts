import { ID_PREFIXES, PROJECT_ID_MAX_LENGTH, PROJECT_ID_PATTERN, type IdKind } from "./constants";

const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const ID_RANDOM_LENGTH = 10;

export function isValidProjectId(value: string): boolean {
  return PROJECT_ID_PATTERN.test(value);
}

export function normalizeProjectId(input: string): string | null {
  const candidate = input.trim().toLowerCase();
  return isValidProjectId(candidate) ? candidate : null;
}

export function projectIdFromName(name: string): string | null {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[._-]+/, "")
    .slice(0, PROJECT_ID_MAX_LENGTH)
    .replace(/[._-]+$/, "");
  return isValidProjectId(slug) ? slug : null;
}

export function idPattern(kind: IdKind): RegExp {
  return new RegExp(`^${ID_PREFIXES[kind]}[A-Za-z0-9_-]{1,64}$`);
}

export function isIdOfKind(kind: IdKind, value: string): boolean {
  return idPattern(kind).test(value);
}

export function createId(kind: IdKind): string {
  const bytes = new Uint8Array(ID_RANDOM_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let suffix = "";
  for (const byte of bytes) suffix += ID_ALPHABET.charAt(byte & 31);
  return `${ID_PREFIXES[kind]}${suffix}`;
}
