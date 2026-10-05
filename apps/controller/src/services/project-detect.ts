import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RUN_TARGETS, type BuildTarget, type Framework, type PackageManager, type RunTarget } from "@theone/protocol";
import { readRegularFile } from "../core/files";

export type PackageJson = {
  name?: string;
  version?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: { directories?: { output?: string } };
  workspaces?: unknown;
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
const WORKSPACE_YAML_MAX_BYTES = 256 * 1024;
const MAX_WORKSPACE_PACKAGES = 64;
/** `apps/mobile` or `apps/*`; negations, `**` and other globs are not expanded. */
const WORKSPACE_PATTERN = /^[\w@][\w.@-]*(\/[\w@][\w.@-]*)*(\/\*)?$/;
/** Workspace packages whose run targets are offered on the monorepo (plain `node` packages and `test` are not). */
const WORKSPACE_APP_FRAMEWORKS = new Set<Framework>(["expo", "react-native", "flutter", "electron", "vite", "next"]);
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

/** `packages:` entries of a pnpm-workspace.yaml (a block list of plain or quoted strings). */
export function pnpmWorkspacePackages(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  for (const line of content.split("\n")) {
    if (/^packages:\s*(#.*)?$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages || !line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) break;
    const item = /^\s+-\s*(["']?)([^"'#]+?)\1\s*(#.*)?$/.exec(line);
    if (item) patterns.push(item[2]!);
  }
  return patterns;
}

function workspacePatterns(dir: string, pkg: PackageJson | null): string[] {
  const declared = pkg?.workspaces;
  const listed = Array.isArray(declared) ? declared : Array.isArray((declared as { packages?: unknown } | undefined)?.packages) ? (declared as { packages: unknown[] }).packages : [];
  const yaml = readRegularFile(join(dir, "pnpm-workspace.yaml"), { maxBytes: WORKSPACE_YAML_MAX_BYTES, followSymlinks: true });
  return [...listed, ...(yaml ? pnpmWorkspacePackages(yaml.content) : [])].filter((pattern): pattern is string => typeof pattern === "string");
}

const isRealDir = (path: string): boolean => {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** Project-relative folders of the workspace packages declared by package.json `workspaces` or pnpm-workspace.yaml. */
export function workspacePackageDirs(dir: string, pkg: PackageJson | null): string[] {
  const dirs = new Set<string>();
  for (const raw of workspacePatterns(dir, pkg)) {
    const pattern = raw.trim().replace(/^\.\//, "").replace(/\/+$/, "");
    if (!WORKSPACE_PATTERN.test(pattern) || pattern.split("/").some((part) => part === "." || part === "..")) continue;
    if (!pattern.endsWith("/*")) {
      if (isRealDir(join(dir, pattern))) dirs.add(pattern);
      continue;
    }
    const parent = pattern.slice(0, -2);
    if (!isRealDir(join(dir, parent))) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(join(dir, parent), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules")
        .map((entry) => entry.name)
        .sort();
    } catch {}
    for (const name of entries) dirs.add(`${parent}/${name}`);
  }
  return [...dirs].slice(0, MAX_WORKSPACE_PACKAGES);
}

/** A run target and where it runs: the project root (`dir` null) or a workspace package. */
export type RunTargetSource = { target: RunTarget; dir: string | null; facts: ProjectFacts };

/**
 * Run targets of the project root, plus those of app packages of a monorepo (e.g. the Expo app in `apps/mobile`).
 * Each target is offered once: the root wins, then the first workspace package in path order. `RUN_TARGETS` order.
 */
export function detectRunTargetSources(dir: string): RunTargetSource[] {
  const root = detectProject(dir);
  const sources: RunTargetSource[] = root.runTargets.map((target) => ({ target, dir: null, facts: root }));
  const seen = new Set<RunTarget>(root.runTargets);
  for (const relative of workspacePackageDirs(dir, root.pkg)) {
    const detected = detectProject(join(dir, relative));
    if (!WORKSPACE_APP_FRAMEWORKS.has(detected.framework)) continue;
    const facts = { ...detected, packageManager: detected.packageManager ?? root.packageManager };
    for (const target of facts.runTargets) {
      if (target === "test" || seen.has(target)) continue;
      seen.add(target);
      sources.push({ target, dir: relative, facts });
    }
  }
  return sources.sort((a, b) => RUN_TARGETS.indexOf(a.target) - RUN_TARGETS.indexOf(b.target));
}
