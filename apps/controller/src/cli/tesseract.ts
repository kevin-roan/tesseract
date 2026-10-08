import { relative, sep } from "node:path";
import { parseArgs } from "node:util";
import { restPaths, type SyncChanges, type SyncRequest } from "@tesseract/protocol";
import type { Config } from "../config";
import { locateProject, realpathOrNull } from "../core/paths";
import { formatDiffstat, formatModeChanges, type DiffstatStyle } from "./diffstat";
import { callLocalApi, CliError } from "./local-api";
import type { Output } from "./output";

export const TESSERACT_USAGE = `tesseract (in the sandbox): run it inside /workspace/projects/<project>
(--sync, --pull and the other tesseract commands run on your computer, not here)

Usage:
  tesseract --get [--force] [--json]
      Bring in the changes made on your computer since the last tesseract --sync or --get
      (lines added and removed per file, like git pull). Only projects linked by running
      tesseract --sync on your computer can be got; nothing on your computer is changed.
      --force   also overwrite sandbox edits to the same files (copies of them are kept)
      --json    print the finished sync request as JSON
  tesseract --help`;

const HOST_ONLY_FLAGS = ["--sync", "--pull", "--revert", "--sync-status", "--dry-run"];
const EXIT_CONFLICT = 2;
const EXIT_INTERRUPTED = 130;
const POLL_MS = 1_000;
const PENDING_TIMEOUT_MS = 60_000;
const SETTLE_TIMEOUT_MS = 11 * 60_000;

export type TesseractOptions = {
  cwd: string;
  style: DiffstatStyle;
  signal?: AbortSignal;
  pollMs?: number;
  pendingTimeoutMs?: number;
  now?: () => number;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const pad = (value: number) => String(value).padStart(2, "0");

export function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${plural(minutes, "minute")} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${plural(hours, "hour")} ago`;
  return `${plural(Math.round(hours / 24), "day")} ago`;
}

/** The project whose folder contains `cwd`: `/workspace/projects/<id>/…`. */
export function projectFromCwd(config: Config, cwd: string): string {
  const root = realpathOrNull(config.projectsDir) ?? config.projectsDir;
  const here = realpathOrNull(cwd) ?? cwd;
  const rel = relative(root, here);
  const id = rel.split(sep)[0] ?? "";
  if (!rel || rel.startsWith("..") || id === "" || id === "..") {
    throw new CliError(`Run tesseract --get inside a project folder under ${config.projectsDir}`);
  }
  const location = locateProject(config.projectsDir, id);
  if (!location.exists || location.id !== id) throw new CliError(`${id} is not a project under ${config.projectsDir}`);
  return id;
}

function hostProblem(id: string, changes: SyncChanges, now: number): string | null {
  if (changes.baselineAt === null) return `${id} was never pushed from your computer: run tesseract --sync in its folder there first`;
  const host = changes.host;
  if (!host) return "The Tesseract app on your computer is not connected to this sandbox: open it there";
  if (!host.linked) return `Tesseract on ${host.name} has not linked ${id}: run tesseract --sync in its folder there once`;
  if (!host.online) return `Tesseract on ${host.name} is offline (last seen ${formatAgo(host.lastSeenAt, now)}): open it on your computer`;
  return null;
}

/** What `tesseract --get` prints for a finished request, like `git pull`. */
export function formatGetResult(request: SyncRequest, style: DiffstatStyle, now: number): string[] {
  const result = request.result;
  const lines = [`From ${request.claimedBy ?? "your computer"}:${result?.hostPath ?? ""}`];
  const files = result?.files ?? [];
  if (files.length === 0) lines.push("Already up to date.");
  else lines.push(...formatDiffstat(files, style), ...formatModeChanges(files));
  if (result?.gitFiles) lines.push(`Updated .git (${plural(result.gitFiles, "file")})`);
  if (result && result.conflicts.length > 0) {
    lines.push(`Overwrote ${plural(result.conflicts.length, "sandbox edit")} (--force)${result.backupPath ? `; copies are in ${result.backupPath}` : ""}`);
  }
  const synced = result?.syncedAt ?? request.updatedAt;
  const previous = result?.previousSyncAt;
  lines.push(`Synced at ${formatLocalTime(synced)}${previous ? ` · previous sync ${formatLocalTime(previous)} (${formatAgo(previous, now)})` : ""}`);
  return lines;
}

function conflictLines(request: SyncRequest): string[] {
  const conflicts = request.result?.conflicts ?? [];
  const listed = conflicts.slice(0, 50).map((path) => (path === ".git" ? "  .git (the sandbox repository has new commits or another branch checked out)" : `  ${path}`));
  return [
    `tesseract: the host's changes would overwrite ${plural(conflicts.length, "sandbox edit")} made since the last sync:`,
    ...listed,
    ...(conflicts.length > 50 ? [`  … and ${conflicts.length - 50} more`] : []),
    "Nothing was changed. Commit or move those edits, or run tesseract --get --force (copies of the sandbox versions are kept).",
  ];
}

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
  });

async function findRequest(config: Config, projectId: string, id: string): Promise<SyncRequest> {
  const requests = (await callLocalApi<SyncRequest[]>(config, "GET", restPaths.projectSyncRequests(projectId))) ?? [];
  const request = requests.find((candidate) => candidate.id === id);
  if (!request) throw new CliError(`Sync request ${id} disappeared`);
  return request;
}

async function cancel(config: Config, request: SyncRequest): Promise<boolean> {
  try {
    await callLocalApi(config, "POST", restPaths.syncRequestCancel(request.id));
    return true;
  } catch {
    return false;
  }
}

async function follow(config: Config, created: SyncRequest, output: Output, options: TesseractOptions): Promise<SyncRequest | null> {
  const now = options.now ?? Date.now;
  const started = now();
  let request = created;
  let shown = "";
  while (true) {
    if (request.status !== "pending" && request.status !== "claimed") return request;
    const message = request.status === "pending" ? "Waiting for Tesseract on your computer…" : `Getting changes from ${request.claimedBy ?? "your computer"}…`;
    if (message !== shown) output.err(message);
    shown = message;
    if (options.signal?.aborted) {
      if (request.status === "pending" && (await cancel(config, request))) output.err("Cancelled; nothing was changed.");
      else output.err("Interrupted; the host is already sending the changes and will finish on its own.");
      return null;
    }
    const waited = now() - started;
    if (request.status === "pending" && waited > (options.pendingTimeoutMs ?? PENDING_TIMEOUT_MS)) {
      if (await cancel(config, request)) {
        throw new CliError("Tesseract on your computer did not pick up the request; is it open and connected to this sandbox?");
      }
    } else if (waited > SETTLE_TIMEOUT_MS) {
      throw new CliError(`Sync request ${request.id} is still ${request.status}; check it later with tesseract-controller api GET ${restPaths.projectSyncRequests(request.projectId)}`);
    }
    await delay(options.pollMs ?? POLL_MS, options.signal);
    request = await findRequest(config, request.projectId, request.id);
  }
}

/** `tesseract` inside the sandbox: only `--get` (host → sandbox) works here. */
export async function tesseract(config: Config, args: string[], output: Output, options: TesseractOptions): Promise<number> {
  const hostOnly = args.find((arg) => HOST_ONLY_FLAGS.includes(arg));
  if (hostOnly) throw new CliError(`tesseract ${hostOnly} runs on your computer, in the project's folder; in the sandbox use tesseract --get`, 2);
  const { values } = parseArgs({
    args,
    options: {
      get: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });
  if (values.help || !values.get) {
    output.out(TESSERACT_USAGE);
    return values.help ? 0 : 2;
  }
  const now = options.now ?? Date.now;
  const projectId = projectFromCwd(config, options.cwd);
  const changes = await callLocalApi<SyncChanges>(config, "GET", restPaths.projectSyncChanges(projectId));
  if (!changes) throw new CliError("Empty sync changes response");
  const problem = hostProblem(projectId, changes, now());
  if (problem) throw new CliError(problem);
  const created = await callLocalApi<SyncRequest>(config, "POST", restPaths.projectSyncRequests(projectId), {
    kind: "get",
    force: values.force,
    source: "cli",
  });
  if (!created) throw new CliError("Empty sync request response");
  const request = await follow(config, created, output, options);
  if (!request) return EXIT_INTERRUPTED;
  if (values.json) output.out(JSON.stringify(request, null, 2));
  if (request.status === "applied") {
    if (!values.json) output.out(formatGetResult(request, options.style, now()).join("\n"));
    return 0;
  }
  if (request.status === "cancelled") throw new CliError("The request was cancelled; nothing was changed");
  if ((request.result?.conflicts.length ?? 0) > 0) {
    if (!values.json) output.err(conflictLines(request).join("\n"));
    return EXIT_CONFLICT;
  }
  throw new CliError(`get failed: ${request.error ?? "unknown error"}`);
}
