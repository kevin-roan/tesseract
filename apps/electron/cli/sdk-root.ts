import { resolve } from "node:path";
import { readAndroidConfig, resolvedSdkRoot, saveAndroidConfig } from "../src/core/android";
import type { CliContext } from "./types";

export async function sdkRootFor(context: CliContext): Promise<string> {
  const override = context.values.get("sdk");
  if (override) return resolve(context.cwd, override);
  return resolvedSdkRoot(context.runtime.paths, await readAndroidConfig(context.runtime.configFile));
}

export async function rememberSdkRoot(context: CliContext, sdkRoot: string): Promise<void> {
  if (!context.values.has("sdk")) return;
  await saveAndroidConfig(context.runtime.configFile, context.runtime.paths, { sdkRoot });
}
