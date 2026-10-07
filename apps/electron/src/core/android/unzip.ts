import { createWriteStream } from "node:fs";
import { chmod, mkdir, symlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as yauzl from "yauzl";
import { IpcError } from "../../shared/ipc-types";
import { MODE_PERMISSIONS, MODE_SYMLINK, MODE_TYPE_MASK, ZIP_MODE_SHIFT } from "./constants";
import { ANDROID_LABELS } from "./labels";

const MODE_DIRECTORY = 0o040000;
const DEFAULT_FILE_MODE = 0o644;

export interface ExtractOptions {
  signal?: AbortSignal;
  applyModes?: boolean;
  onProgress?(done: number, total: number): void;
}

export interface ExtractResult {
  entries: number;
  files: number;
  symlinks: number;
}

function openZip(file: string): Promise<yauzl.ZipFile> {
  return new Promise((resolvePromise, reject) => {
    yauzl.open(file, { lazyEntries: true, autoClose: false, strictFileNames: false }, (error, zip) => {
      if (error || !zip) reject(error ?? new Error(`Cannot open ${file}`));
      else resolvePromise(zip);
    });
  });
}

function openEntry(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((resolvePromise, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) reject(error ?? new Error(`Cannot read ${entry.fileName}`));
      else resolvePromise(stream);
    });
  });
}

function nextEntry(zip: yauzl.ZipFile): Promise<yauzl.Entry | null> {
  return new Promise((resolvePromise, reject) => {
    const cleanup = () => {
      zip.off("entry", onEntry);
      zip.off("end", onEnd);
      zip.off("error", onError);
    };
    const onEntry = (entry: yauzl.Entry) => {
      cleanup();
      resolvePromise(entry);
    };
    const onEnd = () => {
      cleanup();
      resolvePromise(null);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    zip.on("entry", onEntry);
    zip.on("end", onEnd);
    zip.on("error", onError);
    zip.readEntry();
  });
}

async function readText(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export function safeEntryPath(root: string, name: string): string {
  const normalized = name.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((segment) => segment.length > 0 && segment !== ".");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || segments.includes("..") || segments.length === 0) {
    throw new IpcError("invalid_argument", ANDROID_LABELS.install.unsafeEntry(name));
  }
  const target = resolve(root, ...segments);
  if (!isInside(root, target)) throw new IpcError("invalid_argument", ANDROID_LABELS.install.unsafeEntry(name));
  return target;
}

export async function extractZip(file: string, destination: string, options: ExtractOptions = {}): Promise<ExtractResult> {
  const root = resolve(destination);
  const applyModes = options.applyModes ?? process.platform !== "win32";
  await mkdir(root, { recursive: true });
  const zip = await openZip(file);
  const links: { target: string; link: string; name: string }[] = [];
  const result: ExtractResult = { entries: zip.entryCount, files: 0, symlinks: 0 };
  let done = 0;
  try {
    for (;;) {
      if (options.signal?.aborted) throw new IpcError("cancelled", ANDROID_LABELS.install.cancelled);
      const entry = await nextEntry(zip);
      if (!entry) break;
      const target = safeEntryPath(root, entry.fileName);
      const mode = (entry.externalFileAttributes >>> ZIP_MODE_SHIFT) & 0xffff;
      const type = mode & MODE_TYPE_MASK;
      if (entry.fileName.endsWith("/") || type === MODE_DIRECTORY) {
        await mkdir(target, { recursive: true });
      } else if (type === MODE_SYMLINK) {
        links.push({ target: await readText(await openEntry(zip, entry)), link: target, name: entry.fileName });
      } else {
        await mkdir(dirname(target), { recursive: true });
        const permissions = mode & MODE_PERMISSIONS;
        await pipeline(await openEntry(zip, entry), createWriteStream(target, { mode: permissions || DEFAULT_FILE_MODE }), {
          signal: options.signal,
        });
        if (applyModes && permissions) await chmod(target, permissions);
        result.files += 1;
      }
      done += 1;
      options.onProgress?.(done, result.entries);
    }
    for (const { target, link, name } of links) {
      if (isAbsolute(target) || !isInside(root, resolve(dirname(link), target))) {
        throw new IpcError("invalid_argument", ANDROID_LABELS.install.unsafeLink(name));
      }
      await mkdir(dirname(link), { recursive: true });
      await symlink(target, link);
      result.symlinks += 1;
    }
  } catch (error) {
    if (options.signal?.aborted) throw new IpcError("cancelled", ANDROID_LABELS.install.cancelled);
    throw error;
  } finally {
    zip.close();
  }
  return result;
}
