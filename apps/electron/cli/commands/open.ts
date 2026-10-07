import { launchDetached } from "../../src/core/docker/system";
import { runCommand } from "../../src/core/process";
import { IpcError } from "../../src/shared/ipc-types";
import { DEFAULT_PAGE, isPageId, PAGE_IDS, type PageId } from "../../src/shared/routes";
import { DEEP_LINK_SCHEME } from "../../src/shared/runtime";
import { LINK_OPENERS, OPENER_TIMEOUT_MS } from "../constants";
import { emit, guarded, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.open;

export type OpenResult = { via: "app"; target: string; page: PageId } | { via: "link"; target: string; page: PageId };

export function deepLink(page: PageId): string {
  return `${DEEP_LINK_SCHEME}://${page}`;
}

export function appArgs(page: PageId): string[] {
  return ["--page", page];
}

export function pageFrom(args: readonly string[]): PageId {
  const page = args[0] ?? DEFAULT_PAGE;
  if (!isPageId(page)) usageError(LABELS.unknownPage(page, PAGE_IDS.join(", ")));
  return page;
}

async function openLink(context: CliContext, url: string): Promise<boolean> {
  const opener = LINK_OPENERS[context.runtime.platform as keyof typeof LINK_OPENERS];
  if (!opener) return false;
  const result = await runCommand(opener.file, [...opener.args, url], { timeoutMs: OPENER_TIMEOUT_MS, env: context.env });
  return result.code === 0;
}

export async function openApp(context: CliContext, page: PageId): Promise<OpenResult> {
  const executable = context.runtime.appExecutable();
  if (executable) {
    launchDetached(executable, appArgs(page), context.env);
    return { via: "app", target: executable, page };
  }
  const url = deepLink(page);
  if (await openLink(context, url)) return { via: "link", target: url, page };
  throw new IpcError("not_found", LABELS.notFound);
}

export default defineCommand({
  name: "open",
  trigger: { subcommand: "open" },
  summary: CLI_LABELS.summary.open,
  usage: CLI_LABELS.usageLines.open,
  run: (context) =>
    guarded(context, async () => {
      const result = await openApp(context, pageFrom(context.args));
      emit(context, result, (value) => [value.via === "app" ? LABELS.launched(value.target) : LABELS.linked(value.target)]);
      return EXIT.ok;
    }),
});
