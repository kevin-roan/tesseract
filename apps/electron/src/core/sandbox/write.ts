import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export async function writeEnvAtomic(file: string, text: string): Promise<void> {
  const dir = dirname(file);
  await mkdir(dir, { recursive: true, mode: DIR_MODE });
  await chmod(dir, DIR_MODE).catch(() => undefined);
  const temp = join(dir, `.${basename(file)}.${process.pid}.tmp`);
  await writeFile(temp, text, { mode: FILE_MODE });
  await chmod(temp, FILE_MODE).catch(() => undefined);
  await rename(temp, file);
}
