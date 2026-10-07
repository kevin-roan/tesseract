import { app } from "electron";
import { cacheDir, configFilePath, currentPathEnvironment, stateDir, type PathEnvironment } from "../core/paths";
import type { AppPaths } from "../shared/contracts/app";
import { ENV, type Appearance, type Platform } from "../shared/runtime";
import type { LaunchArgs } from "./app/args";

export interface MainContext {
  args: LaunchArgs;
  fixtures: boolean;
  isTest: boolean;
  paths: PathEnvironment;
  configFile: string;
  appearanceOverride: Appearance | null;
}

let current: MainContext | null = null;

export function initContext(args: LaunchArgs): MainContext {
  const paths = currentPathEnvironment(app.getPath("userData"));
  current = {
    args,
    fixtures: process.env[ENV.fixtures] === "1" || args.snapshot !== null,
    isTest: args.snapshot !== null || process.env[ENV.snapshot] === "1",
    paths,
    configFile: configFilePath(paths),
    appearanceOverride: args.snapshot?.appearance ?? null,
  };
  return current;
}

export function mainContext(): MainContext {
  if (!current) throw new Error("Main context is not initialised");
  return current;
}

export function appPaths(): AppPaths {
  const context = mainContext();
  return {
    configFile: context.configFile,
    userData: app.getPath("userData"),
    logs: app.getPath("logs"),
    stateDir: stateDir(context.paths),
    cacheDir: cacheDir(context.paths),
  };
}

export function platform(): Platform {
  return process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux";
}
