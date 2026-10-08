import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseEnvFile } from "../sandbox/env-file";
import { DEFAULT_IMAGE, DEFAULT_PROJECT } from "../sandbox/constants";
import { ENV_BACKUP_SUFFIX, ENV_PREFIX, LEGACY_ENV_PREFIXES, LEGACY_IMAGES, LEGACY_PROJECTS } from "./constants";

const FILE_MODE = 0o600;
const ASSIGNMENT = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

const VALUE_RENAMES: Record<string, readonly string[]> = {
  TESSERACT_COMPOSE_PROJECT: LEGACY_PROJECTS,
  TESSERACT_VOLUME_PREFIX: LEGACY_PROJECTS,
  TESSERACT_IMAGE: LEGACY_IMAGES,
};

const VALUE_DEFAULTS: Record<string, string> = {
  TESSERACT_COMPOSE_PROJECT: DEFAULT_PROJECT,
  TESSERACT_VOLUME_PREFIX: DEFAULT_PROJECT,
  TESSERACT_IMAGE: DEFAULT_IMAGE,
};

export interface EnvMigration {
  text: string;
  renamed: string[];
}

export function migratedKey(key: string): string | null {
  const prefix = LEGACY_ENV_PREFIXES.find((candidate) => key.startsWith(candidate));
  return prefix ? `${ENV_PREFIX}${key.slice(prefix.length)}` : null;
}

function shadowed(key: string, keys: ReadonlySet<string>): boolean {
  const index = LEGACY_ENV_PREFIXES.findIndex((candidate) => key.startsWith(candidate));
  const rest = key.slice((LEGACY_ENV_PREFIXES[index] ?? "").length);
  return LEGACY_ENV_PREFIXES.slice(0, index).some((earlier) => keys.has(`${earlier}${rest}`));
}

export function migrateEnvText(text: string): EnvMigration {
  const original = new Set(Object.keys(parseEnvFile(text)));
  const keys = new Set(original);
  const renamed: string[] = [];
  const lines = text.split("\n").map((line) => {
    const match = ASSIGNMENT.exec(line);
    if (!match) return line;
    const [, lead = "", key = "", raw = ""] = match;
    const next = migratedKey(key);
    if (!next || keys.has(next) || shadowed(key, original)) return line;
    keys.add(next);
    renamed.push(key);
    const value = parseEnvFile(`${next}=${raw}`)[next] ?? "";
    const replacement = VALUE_RENAMES[next]?.includes(value) ? VALUE_DEFAULTS[next] : undefined;
    return `${lead}${next}=${replacement ?? raw}`;
  });
  return { text: lines.join("\n"), renamed };
}

export function envBackupPath(file: string): string {
  return `${file}${ENV_BACKUP_SUFFIX}`;
}

function freeBackupPath(file: string, now: Date): string {
  const backup = envBackupPath(file);
  if (!existsSync(backup)) return backup;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "").slice(0, 14);
  return `${backup}.${stamp}`;
}

export function migrateEnvFile(file: string, now: Date = new Date()): string | null {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const migration = migrateEnvText(text);
  if (migration.renamed.length === 0) return null;
  const backup = freeBackupPath(file, now);
  writeFileSync(backup, text, { mode: FILE_MODE });
  const temp = join(dirname(file), `.${basename(file)}.${process.pid}.tmp`);
  writeFileSync(temp, migration.text, { mode: FILE_MODE });
  chmodSync(temp, FILE_MODE);
  renameSync(temp, file);
  return backup;
}
