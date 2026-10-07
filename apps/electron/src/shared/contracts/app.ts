import type { DefineContract } from "../ipc-types";
import type { PageId, PreferencesSectionId } from "../routes";
import type { Appearance, RuntimeInfo } from "../runtime";

export interface AppSettings {
  appearance: Appearance;
  zoom: number;
  sidebarWidth: number;
  hostShellAutostart: boolean;
  sandboxAutostart: boolean;
}

export interface AppPaths {
  configFile: string;
  userData: string;
  logs: string;
  stateDir: string;
  cacheDir: string;
}

export type AppCommand =
  | { type: "navigate"; page: PageId; params?: Record<string, unknown> }
  | { type: "preferences"; section?: PreferencesSectionId }
  | { type: "new-conversation" }
  | { type: "pair" }
  | { type: "pair-host" }
  | { type: "refresh" }
  | { type: "rediscover" }
  | { type: "about" }
  | { type: "deep-link"; url: string };

export interface AppNotification {
  id?: string;
  title: string;
  body?: string;
  command?: AppCommand;
}

export type CliInstallState = "installed" | "missing" | "conflict" | "unsupported";

export interface CliInstallStatus {
  state: CliInstallState;
  binaryPath: string | null;
  linkPath: string | null;
  message: string | null;
}

export type AppContract = DefineContract<{
  methods: {
    runtime(): RuntimeInfo;
    paths(): AppPaths;
    settings(): AppSettings;
    updateSettings(patch: Partial<AppSettings>): AppSettings;
    openExternal(url: string): void;
    showItemInFolder(path: string): void;
    notify(notification: AppNotification): void;
    cliStatus(): CliInstallStatus;
    installCli(): CliInstallStatus;
    rendererIdle(): void;
    quit(): void;
    relaunch(): void;
  };
  events: {
    command: AppCommand;
    settings: AppSettings;
  };
}>;
