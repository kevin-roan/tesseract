import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BuildProfile, BuildTarget, PackageManager } from "@theone/protocol";
import { badRequest } from "../core/errors";
import type { Env } from "../core/exec";
import type { ProjectFacts } from "./project-detect";

export type BuildStage = "install" | "compile" | "package" | "collect";

export type RecipeStep = { stage: Exclude<BuildStage, "collect">; command: string };

export type CollectSpec =
  | { kind: "files"; platform: string; root: string; patterns: string[]; exclude: RegExp | null }
  | { kind: "zip"; platform: string; candidates: string[] };

export type Recipe = {
  steps: RecipeStep[];
  env: Record<string, string>;
  collect: CollectSpec | null;
  requires: string[];
  /** Directory globs (project-relative) deleted after the build, whatever its outcome. */
  cleanup: string[];
};

export type RecipeContext = {
  facts: ProjectFacts;
  target: BuildTarget;
  profile: BuildProfile;
  display: string;
  env?: Env;
};

const ANDROID_SDK_DEFAULT = "/opt/android-sdk";
const JAVA_HOME_DEFAULT = "/opt/java/openjdk";
const WEB_OUTPUT_DIRS = ["dist", "build", "out", "web-build"];
// Gradle and CMake write the native build of every React Native library into its package in
// node_modules (gigabytes per project). The APK is copied to the artifacts first, so all of it
// goes; the next build compiles from scratch.
const ANDROID_PACKAGES = ["node_modules/*", "node_modules/@*/*", "node_modules/.pnpm/*/node_modules/*", "node_modules/.pnpm/*/node_modules/@*/*"];
const ANDROID_CLEANUP = [
  "android/build",
  "android/app/build",
  "android/app/.cxx",
  ...ANDROID_PACKAGES.flatMap((dir) => [`${dir}/android/build`, `${dir}/android/.cxx`]),
];

// npx treats a bare `--no` as an option taking a value: it would swallow the binary name.
const PM_EXEC: Record<PackageManager, string> = {
  npm: "npx --yes=false",
  pnpm: "pnpm exec",
  yarn: "yarn run",
  bun: "bunx --no-install",
};

const TARGET_PLATFORM: Record<Exclude<BuildTarget, "script">, string> = {
  "electron-linux": "linux",
  "electron-windows": "windows",
  "android-apk": "android",
  web: "web",
};

function hasDependencies(facts: ProjectFacts): boolean {
  return facts.deps.size > 0;
}

function installStep(facts: ProjectFacts, pm: PackageManager): RecipeStep[] {
  return facts.pkg && hasDependencies(facts) ? [{ stage: "install", command: `${pm} install` }] : [];
}

function buildScriptStep(facts: ProjectFacts, pm: PackageManager): RecipeStep[] {
  const script = facts.pkg?.scripts?.build;
  if (typeof script !== "string") return [];
  if (/electron-builder|electron-forge/.test(script)) return [];
  return [{ stage: "compile", command: `${pm} run build` }];
}

function wineEnv(display: string, env: Env): Record<string, string> {
  return {
    WINEPREFIX: env.WINEPREFIX ?? join(env.HOME ?? homedir(), ".wine"),
    WINEARCH: "win64",
    WINEDEBUG: "-all",
    WINEDLLOVERRIDES: "mscoree,mshtml=",
    DISPLAY: display,
  };
}

function androidEnv(env: Env): Record<string, string> {
  const result: Record<string, string> = {};
  const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? (existsSync(ANDROID_SDK_DEFAULT) ? ANDROID_SDK_DEFAULT : undefined);
  if (sdk) {
    result.ANDROID_HOME = sdk;
    result.ANDROID_SDK_ROOT = sdk;
  }
  const java = env.JAVA_HOME ?? (existsSync(JAVA_HOME_DEFAULT) ? JAVA_HOME_DEFAULT : undefined);
  if (java) result.JAVA_HOME = java;
  return result;
}

function electronRecipe(context: RecipeContext, pm: PackageManager, windows: boolean): Recipe {
  const { facts, profile } = context;
  const exec = PM_EXEC[pm];
  const env = windows ? wineEnv(context.display, context.env ?? process.env) : {};
  const requires = windows ? ["wine"] : [];
  const steps = [...installStep(facts, pm), ...buildScriptStep(facts, pm)];

  if (facts.electronTool === "electron-forge") {
    steps.push({ stage: "package", command: `${exec} electron-forge make --platform ${windows ? "win32" : "linux"} --arch x64` });
    return {
      steps,
      env,
      requires,
      cleanup: [],
      collect: {
        kind: "files",
        platform: TARGET_PLATFORM[windows ? "electron-windows" : "electron-linux"],
        root: "out/make",
        patterns: windows ? ["**/*.exe", "**/*.msi", "**/*.appx", "**/win32/**/*.zip"] : ["**/*.AppImage", "**/*.deb", "**/*.rpm", "**/linux/**/*.zip"],
        exclude: null,
      },
    };
  }

  const output = facts.pkg?.build?.directories?.output;
  const outputDir = typeof output === "string" && output.trim() ? output.trim() : "dist";
  const platformArgs = windows ? "--win nsis --x64" : "--linux AppImage --x64";
  const profileArgs = profile === "debug" ? " -c.compression=store" : "";
  steps.push({ stage: "package", command: `${exec} electron-builder ${platformArgs} --publish never${profileArgs}` });
  return {
    steps,
    env,
    requires,
    cleanup: [],
    collect: {
      kind: "files",
      platform: TARGET_PLATFORM[windows ? "electron-windows" : "electron-linux"],
      root: outputDir,
      patterns: windows ? ["*.exe"] : ["*.AppImage", "*.deb"],
      exclude: windows ? /__uninstaller/ : null,
    },
  };
}

function androidRecipe(context: RecipeContext, pm: PackageManager): Recipe {
  const { facts, profile } = context;
  const steps = [...installStep(facts, pm)];
  if (!facts.hasAndroidDir) {
    steps.push({ stage: "compile", command: `${PM_EXEC[pm]} expo prebuild --platform android --no-install` });
  }
  const task = profile === "release" ? "assembleRelease" : "assembleDebug";
  steps.push({ stage: "package", command: `cd android && sh ./gradlew ${task} --no-daemon --console=plain` });
  return {
    steps,
    env: androidEnv(context.env ?? process.env),
    requires: ["java"],
    cleanup: ANDROID_CLEANUP,
    collect: {
      kind: "files",
      platform: TARGET_PLATFORM["android-apk"],
      root: join("android", "app", "build", "outputs", "apk"),
      patterns: [`**/${profile}/**/*.apk`],
      exclude: null,
    },
  };
}

export function resolveRecipe(context: RecipeContext): Recipe {
  const { facts, target } = context;
  if (!facts.buildTargets.includes(target)) {
    const available = facts.buildTargets.length ? facts.buildTargets.join(", ") : "none";
    throw badRequest(`Target ${target} is not available for this project (detected: ${available})`);
  }
  const pm = facts.packageManager ?? "npm";
  switch (target) {
    case "electron-linux":
      return electronRecipe(context, pm, false);
    case "electron-windows":
      return electronRecipe(context, pm, true);
    case "android-apk":
      return androidRecipe(context, pm);
    case "web":
      return {
        steps: [...installStep(facts, pm), { stage: "compile", command: `${pm} run build` }],
        env: {},
        requires: [],
        cleanup: [],
        collect: { kind: "zip", platform: TARGET_PLATFORM.web, candidates: WEB_OUTPUT_DIRS },
      };
    case "script":
      return {
        steps: [...installStep(facts, pm), { stage: "compile", command: `${pm} run build` }],
        env: {},
        requires: [],
        cleanup: [],
        collect: null,
      };
  }
}
