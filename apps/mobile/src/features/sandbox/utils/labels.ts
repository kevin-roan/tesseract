import { BUILD_PROFILES, type BuildProfile, type BuildTarget, type Framework, type TerminalKind } from "@theone/protocol";

import type { ChoiceOption } from "@/components/choice-group";

import type { BuildTargetMeta, BuildTargetOption } from "../types";

const BUILD_TARGETS: Record<BuildTarget, BuildTargetMeta> = {
  "electron-linux": { label: "Linux AppImage", platform: "Electron" },
  "electron-windows": { label: "Windows installer", platform: "Electron + wine" },
  "android-apk": { label: "Android APK", platform: "Gradle" },
  web: { label: "Web bundle", platform: "Static files" },
  script: { label: "Build script", platform: "Logs only" },
};

const FRAMEWORKS: Record<Framework, string> = {
  expo: "Expo",
  "react-native": "React Native",
  electron: "Electron",
  vite: "Vite",
  next: "Next.js",
  node: "Node",
  android: "Android",
  python: "Python",
  unknown: "Project",
};

const TERMINAL_KINDS: Record<TerminalKind, string> = {
  shell: "Shell",
  claude: "Claude Code",
};

const PROFILES: Record<BuildProfile, string> = {
  debug: "Debug",
  release: "Release",
};

export const buildTargetLabel = (target: BuildTarget): string => BUILD_TARGETS[target].label;
export const buildTargetOptions = (targets: readonly BuildTarget[]): BuildTargetOption[] =>
  targets.map((target) => ({ target, ...BUILD_TARGETS[target] }));
export const frameworkLabel = (framework: Framework): string => FRAMEWORKS[framework];
export const terminalKindLabel = (kind: TerminalKind): string => TERMINAL_KINDS[kind];
export const buildProfileLabel = (profile: BuildProfile): string => PROFILES[profile];

export const BUILD_PROFILE_OPTIONS: ChoiceOption[] = BUILD_PROFILES.map((profile) => ({
  id: profile,
  label: PROFILES[profile],
}));

export const isBuildProfile = (value: string): value is BuildProfile =>
  (BUILD_PROFILES as readonly string[]).includes(value);
