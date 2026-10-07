import { readConfig, updateConfig } from "../../src/core/config";
import { IpcError } from "../../src/shared/ipc-types";
import { configValue, isSecretKey, redactConfig, setConfigValue, unsetConfigValue } from "../config-keys";
import { REDACTED_VALUE } from "../constants";
import { emit, guarded, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.config;

export function formatValue(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return JSON.stringify(value, null, 2).split("\n");
}

async function get(context: CliContext): Promise<number> {
  const data = await readConfig(context.runtime.configFile);
  const reveal = context.flags.has("reveal");
  const key = context.args[1];
  if (!key) {
    emit(context, reveal ? data : redactConfig(data), formatValue);
    return EXIT.ok;
  }
  const value = configValue(data, key);
  if (value === undefined) throw new IpcError("not_found", LABELS.missingKey(key));
  emit(context, isSecretKey(key) && !reveal ? REDACTED_VALUE : value, formatValue);
  return EXIT.ok;
}

async function set(context: CliContext): Promise<number> {
  const [, key, raw] = context.args;
  if (!key) usageError(CLI_LABELS.missingArgument("config set", "<key>"));
  if (raw === undefined) usageError(CLI_LABELS.missingArgument("config set", "<value>"));
  const force = context.flags.has("force");
  await updateConfig(context.runtime.configFile, (data) => setConfigValue(data, key, raw, context.runtime.paths, force));
  emit(context, { ok: true, key }, () => [LABELS.saved(key)]);
  return EXIT.ok;
}

async function unset(context: CliContext): Promise<number> {
  const key = context.args[1];
  if (!key) usageError(CLI_LABELS.missingArgument("config unset", "<key>"));
  await updateConfig(context.runtime.configFile, (data) => unsetConfigValue(data, key, context.runtime.paths));
  emit(context, { ok: true, key }, () => [LABELS.removed(key)]);
  return EXIT.ok;
}

async function path(context: CliContext): Promise<number> {
  emit(context, { path: context.runtime.configFile }, (value) => [value.path]);
  return EXIT.ok;
}

const ACTIONS: Readonly<Record<string, (context: CliContext) => Promise<number>>> = { get, set, unset, path };

export default defineCommand({
  name: "config",
  trigger: { subcommand: "config" },
  summary: CLI_LABELS.summary.config,
  usage: CLI_LABELS.usageLines.config,
  flags: ["reveal", "force"],
  run: (context) =>
    guarded(context, async () => {
      const name = context.args[0] ?? "get";
      const action = ACTIONS[name];
      if (!action) usageError(CLI_LABELS.unknownSubcommand("config", name));
      return action(context);
    }),
});
