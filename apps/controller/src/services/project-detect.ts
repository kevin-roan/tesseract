import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BuildTarget, Framework, PackageManager, RunTarget } from "@theone/protocol";
import { readRegularFile } from "../core/files";

export type PackageJson = {
  name?: string;
  version?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: { directories?: { output?: string } };
};

export type ProjectFacts = {
  pkg: PackageJson | null;
  deps: Set<string>;
  framework: Framework;
  packageManager: PackageManager | null;
  scripts: string[];
  /** Whether `node_modules` exists; null when package.json declares no dependencies. */
  dependenciesInstalled: boolean | null;
  buildTargets: BuildTarget[];
  electronTool: "electron-builder" | "electron-forge" | null;
  hasAndroidDir: boolean;
  /** App run targets offered for the project (app-runs-and-emulator.md §1.1), in `RUN_TARGETS` order. */
  runTargets: RunTarget[];
};

const LOCKFILES: readonly [string, PackageManager][] = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

const PYTHON_MARKERS = ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"];
const GRADLE_MARKERS = ["build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"];
const EXPO_CONFIGS = ["app.json", "app.config.js", "app.config.ts"];
export const PACKAGE_JSON_MAX_BYTES = 1024 * 1024;
const PUBSPEC_MAX_BYTES = 256 * 1024;
const FLUTTER_SDK_DEPENDENCY = /^\s+sdk:\s*["']?flutter["']?\s*$/m;

/** A symlinked package.json may point at /dev/zero or a multi-GiB file; only small regular files are parsed. */
function readPackageJson(dir: string): PackageJson | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  const file = readRegularFile(path, { maxBytes: PACKAGE_JSON_MAX_BYTES, followSymlinks: true });
  if (!file) return {};
  try {
    const parsed: unknown = JSON.parse(file.content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as PackageJson) : {};
  } catch {
    return {};
  }
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function detectPackageManager(dir: string, pkg: PackageJson | null): PackageManager | null {
  for (const [file, manager] of LOCKFILES) {
    if (existsSync(join(dir, file))) return manager;
  }
  const declared = typeof pkg?.packageManager === "string" ? pkg.packageManager.split("@")[0] : undefined;
  if (declared === "bun" || declared === "pnpm" || declared === "yarn" || declared === "npm") return declared;
  return null;
}

function isFlutterProject(dir: string): boolean {
  const file = readRegularFile(join(dir, "pubspec.yaml"), { maxBytes: PUBSPEC_MAX_BYTES, followSymlinks: true });
  return file !== null && FLUTTER_SDK_DEPENDENCY.test(file.content);
}

function detectFramework(dir: string, pkg: PackageJson | null, deps: Set<string>, hasAndroidDir: boolean): Framework {
  if (pkg) {
    if (deps.has("electron") || deps.has("electron-builder") || deps.has("@electron-forge/cli")) return "electron";
    if (deps.has("expo")) return "expo";
    if (deps.has("react-native")) return "react-native";
    if (deps.has("next")) return "next";
    if (deps.has("vite")) return "vite";
    return "node";
  }
  if (isFlutterProject(dir)) return "flutter";
  if (hasAndroidDir || GRADLE_MARKERS.some((file) => existsSync(join(dir, file)))) return "android";
  if (PYTHON_MARKERS.some((file) => existsSync(join(dir, file)))) return "python";
  return "unknown";
}

/** Build-target detection per blueprint §5.5, refined so recipes only appear where they can run. */
function detectTargets(
  dir: string,
  framework: Framework,
  deps: Set<string>,
  scripts: Record<string, string>,
  hasAndroidDir: boolean,
  electronTool: ProjectFacts["electronTool"],
): BuildTarget[] {
  const targets: BuildTarget[] = [];
  if (electronTool) targets.push("electron-linux", "electron-windows");
  const expoApp = deps.has("expo") && EXPO_CONFIGS.some((file) => existsSync(join(dir, file)));
  if (expoApp || (hasAndroidDir && existsSync(join(dir, "android", "gradlew")))) targets.push("android-apk");
  if (scripts.build !== undefined) {
    if (framework !== "electron") targets.push("web");
    targets.push("script");
  }
  return targets;
}

/** The script a dev-server target runs: `dev` when present, else `start`. */
export function devScript(scripts: readonly string[]): "dev" | "start" | null {
  if (scripts.includes("dev")) return "dev";
  return scripts.includes("start") ? "start" : null;
}

function detectRunTargets(dir: string, framework: Framework, deps: Set<string>, scripts: string[], hasAndroidDir: boolean): RunTarget[] {
  const targets: RunTarget[] = [];
  const hasDevScript = devScript(scripts) !== null;
  if ((framework === "vite" || framework === "next" || framework === "node") && hasDevScript) targets.push("web-dev");
  if (framework === "expo") {
    targets.push("expo-device");
    if (deps.has("react-native-web")) targets.push("expo-web");
    targets.push("expo-android");
  }
  if (framework === "react-native" && existsSync(join(dir, "android", "gradlew"))) targets.push("rn-android");
  if (framework === "flutter") {
    targets.push("flutter-web");
    if (existsSync(join(dir, "linux"))) targets.push("flutter-linux");
    if (hasAndroidDir) targets.push("flutter-android");
  }
  if (framework === "electron" && hasDevScript) targets.push("electron-dev");
  if (framework === "flutter" || scripts.includes("test")) targets.push("test");
  return targets;
}

export function detectProject(dir: string): ProjectFacts {
  const pkg = readPackageJson(dir);
  const dependencies = stringRecord(pkg?.dependencies);
  const devDependencies = stringRecord(pkg?.devDependencies);
  const deps = new Set([...Object.keys(dependencies), ...Object.keys(devDependencies)]);
  const scripts = stringRecord(pkg?.scripts);
  const hasAndroidDir = existsSync(join(dir, "android"));
  const electronTool = deps.has("electron-builder")
    ? "electron-builder"
    : deps.has("@electron-forge/cli")
      ? "electron-forge"
      : null;
  const framework = detectFramework(dir, pkg, deps, hasAndroidDir);
  const scriptNames = Object.keys(scripts);
  return {
    pkg,
    deps,
    framework,
    packageManager: detectPackageManager(dir, pkg),
    scripts: scriptNames,
    dependenciesInstalled: pkg && deps.size > 0 ? existsSync(join(dir, "node_modules")) : null,
    buildTargets: detectTargets(dir, framework, deps, scripts, hasAndroidDir, electronTool),
    electronTool,
    hasAndroidDir,
    runTargets: detectRunTargets(dir, framework, deps, scriptNames, hasAndroidDir),
  };
}
