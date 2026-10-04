import { constants, existsSync } from "node:fs";
import { chmod, copyFile, lstat, mkdir, readdir, readlink, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256File, sha256Text } from "./sync-get";

export type SyncBlob = { kind: "file" | "symlink"; path: string };

const LINK_SUFFIX = ".link";

/**
 * Content-addressed copies of baseline content, so a discard can restore it:
 * `<root>/<projectId>/<sha256>` (file content) or `<sha256>.link` (a symlink's target, hashed like the manifest does).
 */
export class SyncBlobStore {
  constructor(private readonly root: string) {}

  find(projectId: string, sha256: string): SyncBlob | null {
    const file = join(this.root, projectId, sha256);
    if (existsSync(file)) return { kind: "file", path: file };
    if (existsSync(`${file}${LINK_SUFFIX}`)) return { kind: "symlink", path: `${file}${LINK_SUFFIX}` };
    return null;
  }

  /** Stores the file or symlink at `full` when its content hashes to `sha256`; returns whether the blob exists afterwards. */
  async capture(projectId: string, full: string, sha256: string): Promise<boolean> {
    const stats = await lstat(full).catch(() => null);
    if (!stats || !(stats.isFile() || stats.isSymbolicLink())) return false;
    const dir = join(this.root, projectId);
    const dest = join(dir, stats.isSymbolicLink() ? `${sha256}${LINK_SUFFIX}` : sha256);
    if (existsSync(dest)) return true;
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const temp = `${dest}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      if (stats.isSymbolicLink()) {
        const target = await readlink(full);
        if (sha256Text(target) !== sha256) return false;
        await writeFile(temp, target, { mode: 0o600 });
      } else {
        await copyFile(full, temp, constants.COPYFILE_FICLONE);
        await chmod(temp, 0o600);
        if ((await sha256File(temp)) !== sha256) return false;
      }
      await rename(temp, dest);
      return true;
    } finally {
      await rm(temp, { force: true });
    }
  }

  /** Removes every blob of the project not in `referenced` (and leftover temp files). */
  async keepOnly(projectId: string, referenced: ReadonlySet<string>): Promise<void> {
    const dir = join(this.root, projectId);
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names) {
      const sha256 = name.endsWith(LINK_SUFFIX) ? name.slice(0, -LINK_SUFFIX.length) : name;
      if (!referenced.has(sha256)) await rm(join(dir, name), { force: true });
    }
  }

  async removeProject(projectId: string): Promise<void> {
    await rm(join(this.root, projectId), { recursive: true, force: true });
  }
}
