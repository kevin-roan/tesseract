import { TheOneClient } from "@theone/client";
import { resolveConnection } from "../../src/core/syncback";
import { emit, guarded, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";

const FLAG = "gemini-key";
const LABELS = CLI_LABELS.gemini;

async function run(context: CliContext): Promise<number> {
  const key = context.values.get(FLAG)?.trim();
  if (!key) usageError(LABELS.missingKey);
  const config = await resolveConnection({ env: context.env, configFile: context.runtime.configFile }, context.io);
  if (!config) return EXIT.error;
  const client = new TheOneClient({ baseUrl: config.apiUrl, token: config.token });
  const status = await client.updateStt({ geminiApiKey: key }, { signal: context.signal });
  emit(context, { ok: true, sandbox: config.name || config.apiUrl, model: status.gemini.model }, (result) => [
    LABELS.saved(result.sandbox),
  ]);
  return EXIT.ok;
}

export const geminiKeyFlag = defineCommand({
  name: "--gemini-key",
  trigger: { flag: FLAG },
  summary: CLI_LABELS.help.geminiKey,
  usage: [LABELS.usage],
  valueFlags: [FLAG],
  run: (context) => guarded(context, () => run(context)),
});
