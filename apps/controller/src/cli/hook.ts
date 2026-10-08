import { parseJson, restPaths } from "@tesseract/protocol";
import { loadConfig } from "../config";
import type { Env } from "../core/exec";
import { HOOK_AGENT_RUN_FIELD, HOOK_TERMINAL_FIELD } from "../services/claude-hooks";
import { fetchLocalApi } from "./local-api";

export const HOOK_TIMEOUT_MS = 1_500;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

async function forward(env: Env, readStdin: () => Promise<string>, timeoutMs: number): Promise<void> {
  const config = loadConfig(env);
  const parsed = parseJson(await readStdin());
  if (!parsed.ok || !isRecord(parsed.value)) return;
  const payload = {
    ...parsed.value,
    ...(env.TESSERACT_TERMINAL_ID ? { [HOOK_TERMINAL_FIELD]: env.TESSERACT_TERMINAL_ID } : {}),
    ...(env.TESSERACT_AGENT_RUN_ID ? { [HOOK_AGENT_RUN_FIELD]: env.TESSERACT_AGENT_RUN_ID } : {}),
  };
  await fetchLocalApi(config, "POST", restPaths.claudeHook(), JSON.stringify(payload), timeoutMs);
}

/**
 * `tesseract-controller hook`: forwards the Claude Code hook JSON on stdin to the controller.
 * Always exits 0 within the timeout and prints nothing, so a controller outage never blocks Claude.
 */
export async function hook(env: Env, readStdin: () => Promise<string>, timeoutMs = HOOK_TIMEOUT_MS): Promise<number> {
  await Promise.race([forward(env, readStdin, timeoutMs).catch(() => undefined), Bun.sleep(timeoutMs)]);
  return 0;
}
