import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CLI_NAME } from "../../shared/runtime";
import {
  CLI_INSTALL_SIDECAR,
  CLI_STABLE_SANDBOX_DIR,
  CLI_USER_COPY_DIR,
  CLI_USER_DATA_DIR,
  SANDBOX_MANIFEST,
  SANDBOX_SYNC_MARKER,
} from "../constants";

export interface SidecarLayout {
  copyPath: string;
  file: string;
  sandboxDir: string;
}

export interface InstallSidecarFile {
  appPath: string;
  sandboxDir: string;
}

export interface SidecarEnvironment {
  home: string;
  appImage: string;
  bundledSandboxDir: string;
}

export function sidecarLayout(home: string): SidecarLayout {
  const root = join(home, ...CLI_USER_DATA_DIR);
  return {
    copyPath: join(home, ...CLI_USER_COPY_DIR, CLI_NAME),
    file: join(root, CLI_INSTALL_SIDECAR),
    sandboxDir: join(root, CLI_STABLE_SANDBOX_DIR),
  };
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function bundleHash(source: string): Promise<string | null> {
  const manifest = await readText(join(source, SANDBOX_MANIFEST));
  return manifest === null ? null : createHash("sha256").update(manifest).digest("hex");
}

export async function syncSandboxContext(source: string, target: string): Promise<boolean> {
  const hash = await bundleHash(source);
  if (hash !== null && (await readText(join(target, SANDBOX_SYNC_MARKER))) === hash) return false;
  const temp = `${target}.${process.pid}.tmp`;
  await rm(temp, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  try {
    await cp(source, temp, { recursive: true, preserveTimestamps: true });
    if (hash !== null) await writeFile(join(temp, SANDBOX_SYNC_MARKER), hash);
    await rm(target, { recursive: true, force: true });
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  return true;
}

export async function writeInstallSidecar(file: string, value: InstallSidecarFile): Promise<void> {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if ((await readText(file)) === text) return;
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, text);
  await rename(temp, file);
}

export async function refreshInstallSidecar(env: SidecarEnvironment): Promise<InstallSidecarFile | null> {
  const layout = sidecarLayout(env.home);
  if (!(await pathExists(layout.copyPath)) || !(await pathExists(env.bundledSandboxDir))) return null;
  await syncSandboxContext(env.bundledSandboxDir, layout.sandboxDir);
  const value = { appPath: env.appImage, sandboxDir: layout.sandboxDir };
  await writeInstallSidecar(layout.file, value);
  return value;
}
