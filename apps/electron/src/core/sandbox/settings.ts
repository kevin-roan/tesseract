import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import type { ReachabilityMode, SandboxComponent, SandboxStackConfig } from "../../shared/contracts/sandbox";
import { readConfig, updateConfig, type ConfigData } from "../config";
import { configFilePath } from "../paths";
import { COMPONENTS, MODES, SANDBOX_IMAGE_REF_ENV, TOKEN_BYTES } from "./constants";
import type { SandboxContext } from "./types";

export const SANDBOX_CONFIG_KEYS = {
  stack: "sandboxStack",
  imageRef: "sandboxImageRef",
} as const;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function sandboxStackFromConfig(data: ConfigData): SandboxStackConfig | null {
  const value = data[SANDBOX_CONFIG_KEYS.stack];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const envFile = text(record.envFile);
  const project = text(record.project);
  const image = text(record.image);
  if (!envFile || !project || !image) return null;
  const mode = MODES.find((candidate) => candidate === record.mode) ?? "local";
  const components = Array.isArray(record.components)
    ? COMPONENTS.filter((component) => (record.components as unknown[]).includes(component))
    : [];
  return { envFile, project, mode: mode as ReachabilityMode, image, builtAt: text(record.builtAt), components };
}

export function withSandboxStack(data: ConfigData, stack: SandboxStackConfig | null): ConfigData {
  const next = { ...data };
  if (stack) next[SANDBOX_CONFIG_KEYS.stack] = { ...stack, components: [...stack.components] as SandboxComponent[] };
  else delete next[SANDBOX_CONFIG_KEYS.stack];
  return next;
}

export function sandboxImageRef(data: ConfigData, env: Record<string, string | undefined>): string | null {
  return text(data[SANDBOX_CONFIG_KEYS.imageRef]) ?? text(env[SANDBOX_IMAGE_REF_ENV]);
}

export function sandboxConfigFile(context: SandboxContext): string {
  return (
    context.configFile ??
    configFilePath({ platform: context.deps?.platform ?? process.platform, env: context.env, home: context.deps?.homeDir ?? homedir() })
  );
}

export async function loadSandboxStack(context: SandboxContext): Promise<SandboxStackConfig | null> {
  return sandboxStackFromConfig(await readConfig(sandboxConfigFile(context)));
}

export async function saveSandboxStack(context: SandboxContext, stack: SandboxStackConfig | null): Promise<void> {
  await updateConfig(sandboxConfigFile(context), (data) => withSandboxStack(data, stack));
}

export async function markBuilt(context: SandboxContext, builtAt: string): Promise<SandboxStackConfig | null> {
  let result: SandboxStackConfig | null = null;
  await updateConfig(sandboxConfigFile(context), (data) => {
    const stack = sandboxStackFromConfig(data);
    if (!stack) return data;
    result = { ...stack, builtAt };
    return withSandboxStack(data, result);
  });
  return result;
}

export async function loadImageRef(context: SandboxContext): Promise<string | null> {
  return sandboxImageRef(await readConfig(sandboxConfigFile(context)), context.env);
}

export function generateToken(bytes = TOKEN_BYTES): string {
  return randomBytes(bytes).toString("base64url");
}
