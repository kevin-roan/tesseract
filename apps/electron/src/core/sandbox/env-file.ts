import { PATTERNS, TRUTHY_FLAGS } from "./constants";

export type EnvValues = Record<string, string>;

export const ENV_KEYS = [
  "TESSERACT_MODE",
  "TESSERACT_DIND",
  "TESSERACT_COMPOSE_PROJECT",
  "TESSERACT_VOLUME_PREFIX",
  "TESSERACT_IMAGE",
  "TS_AUTHKEY",
  "TS_TAILNET_DOMAIN",
  "TESSERACT_HOSTNAME",
  "TESSERACT_BIND_ADDR",
  "TESSERACT_CONTROLLER_HOST_PORT",
  "TESSERACT_VNC_HOST_PORT",
  "TESSERACT_TOKEN",
  "TESSERACT_HOST_CLAUDE_DIR",
  "SANDBOX_CPUS",
  "SANDBOX_MEMORY",
  "TZ",
  "DEV_UID",
  "DEV_GID",
  "WITH_ANDROID",
  "WITH_FLUTTER",
  "FLUTTER_VERSION",
  "WITH_MONO",
  "WITH_WHISPER",
  "WHISPER_MODELS",
  "CLAUDE_CODE_VERSION",
  "CLAUDE_CODE_OAUTH_TOKEN",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

function unquote(raw: string): string {
  if (raw.startsWith('"') && raw.indexOf('"', 1) !== -1) return raw.slice(1, raw.indexOf('"', 1));
  if (raw.startsWith("'") && raw.indexOf("'", 1) !== -1) return raw.slice(1, raw.indexOf("'", 1));
  const comment = /\s#/.exec(raw);
  return (comment ? raw.slice(0, comment.index) : raw).replace(/\s+$/, "");
}

export function parseEnvFile(text: string): EnvValues {
  const raw: EnvValues = {};
  for (const source of text.split(/\r?\n/)) {
    let line = source.replace(/^\s+/, "");
    if (line.startsWith("export ")) line = line.slice("export ".length);
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) raw[match[1] as string] = match[2] as string;
  }
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, unquote(value)]));
}

export function envFileValue(text: string, key: string): string {
  return parseEnvFile(text)[key] ?? "";
}

export function quoteEnvValue(value: string): string {
  if (PATTERNS.unquoted.test(value)) return value;
  if (!/["$\\]/.test(value)) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  return `"${value.replace(/[\\"$]/g, (char) => `\\${char}`)}"`;
}

export function serializeEnv(values: Partial<Record<EnvKey, string>>): string {
  return `${ENV_KEYS.filter((key) => values[key] !== undefined)
    .map((key) => `${key}=${quoteEnvValue(values[key] as string)}`)
    .join("\n")}\n`;
}

export function isTruthyFlag(value: string | undefined): boolean {
  return (TRUTHY_FLAGS as readonly string[]).includes(value ?? "");
}
