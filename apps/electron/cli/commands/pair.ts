import { CONNECTION_ENV, readConfig } from "../../src/core/config";
import { hasSealedToken, readStoredConnection } from "../../src/core/connection";
import { pairingInfo, readPairing } from "../../src/core/sandbox";
import type { PairingInfo } from "../../src/shared/contracts/sandbox";
import { IpcError } from "../../src/shared/ipc-types";
import { emit, guarded } from "../io";
import { CLI_LABELS } from "../labels";
import { renderQr } from "../qr";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.pair;

export async function resolvePairingInfo(context: CliContext): Promise<PairingInfo> {
  try {
    return await readPairing(await context.runtime.sandboxContext());
  } catch (error) {
    const data = await readConfig(context.runtime.configFile);
    const stored = readStoredConnection(data, context.env, null);
    if (stored) return pairingInfo(stored);
    if (!hasSealedToken(data)) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new IpcError("unavailable", LABELS.sealed(reason, CONNECTION_ENV.url, CONNECTION_ENV.token));
  }
}

export function describePairing(info: PairingInfo, options: { qr: boolean; color: boolean }): string[] {
  return [
    LABELS.heading(info.name),
    "",
    info.link,
    ...(options.qr ? ["", ...renderQr(info.link, options.color), ""] : [""]),
    LABELS.scan,
    ...(info.local ? [LABELS.local] : []),
  ];
}

export async function runPair(context: CliContext): Promise<number> {
  const info = await resolvePairingInfo(context);
  emit(context, info, (value) =>
    describePairing(value, { qr: !context.flags.has("no-qr"), color: Boolean(context.io.color) }),
  );
  return EXIT.ok;
}

export default defineCommand({
  name: "pair",
  trigger: { subcommand: "pair" },
  summary: CLI_LABELS.summary.pair,
  usage: CLI_LABELS.usageLines.pair,
  flags: ["no-qr"],
  run: (context) => guarded(context, () => runPair(context)),
});
