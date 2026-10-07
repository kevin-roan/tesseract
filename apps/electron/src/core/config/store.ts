import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LEGACY_CONFIG_DIR_NAME, CONFIG_DIR_NAME } from "../paths";

export type ConfigData = Record<string, unknown>;

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const CONFIG_TEMP_PREFIX = "config.";

export async function readConfig(file: string): Promise<ConfigData> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as ConfigData) : {};
  } catch {
    return {};
  }
}

export async function writeConfig(file: string, data: ConfigData): Promise<void> {
  const dir = dirname(file);
  await mkdir(dir, { recursive: true, mode: DIR_MODE });
  const temp = join(dir, `${CONFIG_TEMP_PREFIX}${process.pid}.tmp`);
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, { mode: FILE_MODE });
  await chmod(temp, FILE_MODE).catch(() => undefined);
  await rename(temp, file);
}

let queue: Promise<unknown> = Promise.resolve();

export function updateConfig(file: string, mutate: (data: ConfigData) => ConfigData | void): Promise<ConfigData> {
  const next = queue.then(async () => {
    const current = await readConfig(file);
    const before = JSON.stringify(current);
    const result = mutate(current) ?? current;
    if (JSON.stringify(result) !== before) await writeConfig(file, result);
    return result;
  });
  queue = next.catch(() => undefined);
  return next;
}

export async function migrateLegacyConfigDir(base: string): Promise<boolean> {
  const target = join(base, CONFIG_DIR_NAME);
  const legacy = join(base, LEGACY_CONFIG_DIR_NAME);
  try {
    await stat(target);
    return false;
  } catch {
    try {
      if (!(await stat(legacy)).isDirectory()) return false;
      await rename(legacy, target);
      return true;
    } catch {
      return false;
    }
  }
}
