import { access, readdir, readFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";
import type { SdkCandidate } from "../../shared/contracts/android";
import { defaultAndroidSdkRoot, type PathEnvironment } from "../paths";
import { PACKAGE_PATHS, PACKAGE_XML, SOURCE_PROPERTIES } from "./constants";
import { formatRevision, parseRevision, revision } from "./revision";
import { child, childText, parseXml } from "./xml";

const SDK_MARKERS = ["emulator", "platform-tools", "platforms", "system-images", "licenses", "build-tools", "cmdline-tools"];

export function exe(platform: NodeJS.Platform, name: string): string {
  return platform === "win32" ? `${name}.exe` : name;
}

export function emulatorBinary(sdkRoot: string, platform: NodeJS.Platform): string {
  return join(sdkRoot, PACKAGE_PATHS.emulator, exe(platform, "emulator"));
}

export function adbBinary(sdkRoot: string, platform: NodeJS.Platform): string {
  return join(sdkRoot, PACKAGE_PATHS.platformTools, exe(platform, "adb"));
}

export function packageDir(sdkRoot: string, path: string): string {
  return join(sdkRoot, ...path.split(";"));
}

export function sdkEnv(sdkRoot: string, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...base, ANDROID_SDK_ROOT: sdkRoot, ANDROID_HOME: sdkRoot };
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export function parseProperties(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const index = line.search(/[=:]/);
    if (index === -1) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/\\(.)/g, "$1");
  }
  return result;
}

async function packageXmlRevision(dir: string): Promise<string | null> {
  try {
    const local = child(parseXml(await readFile(join(dir, PACKAGE_XML), "utf8")), "localPackage");
    const rev = local ? child(local, "revision") : null;
    const major = rev ? childText(rev, "major") : null;
    if (!rev || major === null) return null;
    const optional = (name: string) => {
      const value = childText(rev, name);
      return value === null ? null : Number(value);
    };
    return formatRevision(revision(Number(major), optional("minor"), optional("micro"), optional("preview")));
  } catch {
    return null;
  }
}

async function sourcePropertiesRevision(dir: string): Promise<string | null> {
  try {
    const parsed = parseRevision(parseProperties(await readFile(join(dir, SOURCE_PROPERTIES), "utf8"))["Pkg.Revision"]);
    return parsed ? formatRevision(parsed) : null;
  } catch {
    return null;
  }
}

export async function installedRevision(sdkRoot: string, path: string): Promise<string | null> {
  const dir = packageDir(sdkRoot, path);
  return (await packageXmlRevision(dir)) ?? (await sourcePropertiesRevision(dir));
}

export async function countSystemImages(sdkRoot: string): Promise<number> {
  const base = join(sdkRoot, "system-images");
  let count = 0;
  for (const platform of await readdir(base).catch(() => [] as string[])) {
    for (const tag of await readdir(join(base, platform)).catch(() => [] as string[])) {
      for (const abi of await readdir(join(base, platform, tag)).catch(() => [] as string[])) {
        if (await isDirectory(join(base, platform, tag, abi))) count += 1;
      }
    }
  }
  return count;
}

export function studioSdkRoot(paths: PathEnvironment): string {
  if (paths.platform === "darwin") return join(paths.home, "Library", "Android", "sdk");
  if (paths.platform === "win32") return join(paths.env.LOCALAPPDATA ?? join(paths.home, "AppData", "Local"), "Android", "Sdk");
  return join(paths.home, "Android", "Sdk");
}

export async function looksLikeSdk(root: string): Promise<boolean> {
  for (const marker of SDK_MARKERS) if (await isDirectory(join(root, marker))) return true;
  return false;
}

export async function describeSdk(path: string, source: SdkCandidate["source"], platform: NodeJS.Platform): Promise<SdkCandidate> {
  const hasEmulator = await exists(emulatorBinary(path, platform));
  return {
    path,
    source,
    emulatorRevision: hasEmulator ? ((await installedRevision(path, PACKAGE_PATHS.emulator)) ?? "") : null,
    systemImages: await countSystemImages(path),
  };
}

export async function findSdkCandidates(paths: PathEnvironment): Promise<SdkCandidate[]> {
  const sources: [SdkCandidate["source"], string | undefined][] = [
    ["TESSERACT_ANDROID_SDK_ROOT", paths.env.TESSERACT_ANDROID_SDK_ROOT],
    ["ANDROID_SDK_ROOT", paths.env.ANDROID_SDK_ROOT],
    ["ANDROID_HOME", paths.env.ANDROID_HOME],
    ["studio-default", studioSdkRoot(paths)],
  ];
  const defaultRoot = resolve(defaultAndroidSdkRoot(paths));
  const seen = new Set<string>();
  const candidates: SdkCandidate[] = [];
  for (const [source, value] of sources) {
    if (!value) continue;
    const path = resolve(value);
    if (seen.has(path) || path === defaultRoot) continue;
    if (!(await looksLikeSdk(path))) continue;
    seen.add(path);
    candidates.push(await describeSdk(path, source, paths.platform));
  }
  candidates.push(await describeSdk(defaultRoot, "tesseract-default", paths.platform));
  return candidates;
}

export function preferredSdk(candidates: SdkCandidate[]): SdkCandidate | null {
  return candidates.find((candidate) => candidate.emulatorRevision !== null) ?? candidates[0] ?? null;
}
