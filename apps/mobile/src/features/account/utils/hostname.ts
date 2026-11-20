import { TailnetHostnameSchema } from "@tesseract/protocol";

const MAX_LABEL_LENGTH = 63;
const SUFFIX_LENGTH = 4;
const FALLBACK_NAME = "phone";

export function randomSuffix(random: () => number = Math.random): string {
  return Array.from({ length: SUFFIX_LENGTH }, () => Math.floor(random() * 36).toString(36)).join("");
}

export function slugLabel(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deviceHostname(name: string | null | undefined, suffix: string = randomSuffix()): string {
  const room = MAX_LABEL_LENGTH - suffix.length - 1;
  const base = slugLabel(name).slice(0, room).replace(/-+$/, "") || FALLBACK_NAME;
  return TailnetHostnameSchema.parse(`${base}-${suffix}`);
}
