import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  CreateDeploySchema,
  DEPLOY_STATUSES,
  isIdOfKind,
  restPaths,
  validate,
  type Deploy,
  type DeployFilter,
  type DeployStatus,
  type DeployTargets,
} from "@tesseract/protocol";
import type { Config } from "../config";
import { formatBytes } from "../services/artifacts";
import { callLocalApi, CliError } from "./local-api";
import type { Output } from "./output";
import { formatAgo, formatLocalTime } from "./tesseract";

export const DEPLOY_USAGE = `tesseract-controller deploy <container> [--dir <path>] [--app <name>] [--port <n>] [--hostname <host>]
                                     [--create [--cpus <n>] [--memory <MB>]] [--no-wait] [--json]
                                     deploy a directory with compose.yml/docker-compose.yml or a Dockerfile (default: the
                                     current one) into a server container of the Tesseract desktop app; waits until it
                                     is deployed (the host may ask its user to approve first), prints the URLs
                                     --create: the host creates <container> if it does not exist yet (always asks its
                                     user to approve); --cpus/--memory set its limits (default: the host's)
  tesseract-controller deploy targets [--json]
                                     the server containers the desktop app accepts deploys for
  tesseract-controller deploy ls [--container <name>] [--status <status>] [--json]
  tesseract-controller deploy status <id> [--json]
  tesseract-controller deploy cancel <id> [--json]`;

const ACTIVE = new Set<DeployStatus>(["pending", "claimed", "awaiting_approval", "deploying"]);
const EXIT_INTERRUPTED = 130;
const POLL_MS = 1_000;
const PENDING_TIMEOUT_MS = 5 * 60_000;
const CREATE_TIMEOUT_MS = 10 * 60_000;
const LOG_TAIL_LINES = 40;
const LOG_ANCHOR_CHARS = 256;
const NO_HOST = "No Tesseract desktop app is connected to this sandbox: open it on your computer to deploy to its server containers";

export type DeployCliOptions = {
  cwd: string;
  signal?: AbortSignal;
  pollMs?: number;
  pendingTimeoutMs?: number;
  now?: () => number;
};

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done) => {
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      done();
    }
  });

function table(rows: string[][]): string[] {
  const widths = rows[0]?.map((_, column) => Math.max(...rows.map((row) => row[column]?.length ?? 0))) ?? [];
  return rows.map((row) => row.map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column] ?? 0))).join("  "));
}

export function formatTargets(targets: DeployTargets, now: number): string[] {
  if (targets.host === null) return [NO_HOST];
  const reported = targets.reportedAt ? ` (reported ${formatAgo(targets.reportedAt, now)})` : "";
  if (targets.targets.length === 0) {
    return [`${targets.host} has no server containers${reported}; deploy with --create <name> to have the host create one (its user approves it)`];
  }
  return [
    `Server containers on ${targets.host}${reported}:`,
    ...table([
      ["NAME", "STATE", "APPROVAL", "URLS"],
      ...targets.targets.map((target) => [
        target.name,
        target.running ? "running" : "stopped",
        target.autoApprove ? "auto-approve" : "asks first",
        target.urls.join(" ") || "-",
      ]),
    ]).map((line) => `  ${line}`),
  ];
}

export function formatDeployList(deploys: Deploy[], now: number): string[] {
  if (deploys.length === 0) return ["No deploys"];
  return table([
    ["ID", "STATUS", "CONTAINER", "APP", "CREATED"],
    ...deploys.map((deploy) => [deploy.id, deploy.status, deploy.container, deploy.app, formatAgo(deploy.createdAt, now)]),
  ]);
}

export function formatDeploy(deploy: Deploy, now: number): string[] {
  const route = [deploy.port === null ? null : `port ${deploy.port}`, deploy.hostname].filter((part) => part !== null).join(" · ");
  const log = deploy.log.trimEnd().split("\n").slice(-LOG_TAIL_LINES);
  const limits = [deploy.cpus === null ? null : `${deploy.cpus} cpus`, deploy.memoryMb === null ? null : `${deploy.memoryMb} MB`].filter((part) => part !== null);
  return [
    `${deploy.id}  ${deploy.status}`,
    `  container  ${deploy.container}${deploy.create ? ` (create if missing${limits.length > 0 ? `: ${limits.join(", ")}` : ""})` : ""}`,
    `  app        ${deploy.app} (${deploy.kind})`,
    `  source     ${deploy.sourcePath}${deploy.projectId ? ` (project ${deploy.projectId})` : ""}`,
    `  bundle     ${formatBytes(deploy.bytes)} · sha256 ${deploy.sha256.slice(0, 12)}`,
    ...(route ? [`  route      ${route}`] : []),
    ...(deploy.claimedBy ? [`  host       ${deploy.claimedBy}`] : []),
    `  created    ${formatLocalTime(deploy.createdAt)} (${formatAgo(deploy.createdAt, now)})`,
    `  updated    ${formatLocalTime(deploy.updatedAt)} (${formatAgo(deploy.updatedAt, now)})`,
    ...deploy.urls.map((url, index) => `  ${index === 0 ? "urls       " : "           "}${url}`),
    ...(deploy.error ? [`  error      ${deploy.error}`] : []),
    ...(deploy.log ? [`log (last ${LOG_TAIL_LINES} lines):`, ...log.map((line) => `  ${line}`)] : []),
  ];
}

export function statusLine(deploy: Deploy): string {
  switch (deploy.status) {
    case "pending":
      return "pending: waiting for the Tesseract desktop app to pick it up";
    case "claimed":
      return `claimed by ${deploy.claimedBy ?? "the desktop app"}`;
    case "awaiting_approval":
      return deploy.create
        ? `awaiting approval: waiting for approval to create container ${deploy.container} in the Tesseract desktop app`
        : "awaiting approval: waiting for approval in the Tesseract desktop app";
    case "deploying":
      return `deploying on ${deploy.claimedBy ?? "the desktop app"}`;
    default:
      return deploy.status;
  }
}

/** Text of `next` not yet in `previous`; the log is a tail, so the end of `previous` anchors where the new part starts. */
export function newLogText(previous: string, next: string): string {
  if (next.startsWith(previous)) return next.slice(previous.length);
  const anchor = previous.slice(-LOG_ANCHOR_CHARS);
  const at = anchor ? next.lastIndexOf(anchor) : -1;
  return at === -1 ? next : next.slice(at + anchor.length);
}

function requireId(positionals: string[], command: string): string {
  const id = positionals[0] ?? "";
  if (positionals.length !== 1 || !isIdOfKind("deploy", id)) throw new CliError(`deploy ${command} takes one deploy id (dep_…)\n\n${DEPLOY_USAGE}`, 2);
  return id;
}

async function fetchDeploy(config: Config, id: string): Promise<Deploy> {
  const deploy = await callLocalApi<Deploy>(config, "GET", restPaths.deploy(id));
  if (!deploy) throw new CliError("Empty deploy response");
  return deploy;
}

async function targets(config: Config, args: string[], output: Output, now: number): Promise<number> {
  const { values } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, strict: true });
  const result = await callLocalApi<DeployTargets>(config, "GET", restPaths.deployTargets());
  if (!result) throw new CliError("Empty targets response");
  if (values.json) {
    output.out(JSON.stringify(result, null, 2));
    return 0;
  }
  if (result.host === null) throw new CliError(NO_HOST);
  output.out(formatTargets(result, now).join("\n"));
  return 0;
}

async function list(config: Config, args: string[], output: Output, now: number): Promise<number> {
  const { values } = parseArgs({
    args,
    options: { container: { type: "string" }, status: { type: "string" }, json: { type: "boolean", default: false } },
    strict: true,
  });
  if (values.status !== undefined && !(DEPLOY_STATUSES as readonly string[]).includes(values.status)) {
    throw new CliError(`--status must be one of ${DEPLOY_STATUSES.join(", ")}`, 2);
  }
  const filter: DeployFilter = { ...(values.container ? { container: values.container } : {}), ...(values.status ? { status: values.status as DeployStatus } : {}) };
  const deploys = (await callLocalApi<Deploy[]>(config, "GET", restPaths.deploys(filter))) ?? [];
  output.out(values.json ? JSON.stringify(deploys, null, 2) : formatDeployList(deploys, now).join("\n"));
  return 0;
}

async function status(config: Config, args: string[], output: Output, now: number): Promise<number> {
  const { values, positionals } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, allowPositionals: true, strict: true });
  const deploy = await fetchDeploy(config, requireId(positionals, "status"));
  output.out(values.json ? JSON.stringify(deploy, null, 2) : formatDeploy(deploy, now).join("\n"));
  return 0;
}

async function cancel(config: Config, args: string[], output: Output): Promise<number> {
  const { values, positionals } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, allowPositionals: true, strict: true });
  const deploy = await callLocalApi<Deploy>(config, "POST", restPaths.deployCancel(requireId(positionals, "cancel")));
  if (!deploy) throw new CliError("Empty deploy response");
  output.out(values.json ? JSON.stringify(deploy, null, 2) : `cancelled ${deploy.id} (${deploy.app} to ${deploy.container})`);
  return 0;
}

async function follow(config: Config, created: Deploy, output: Output, options: DeployCliOptions): Promise<Deploy | null> {
  const now = options.now ?? Date.now;
  let deploy = created;
  let shownStatus: DeployStatus | null = null;
  let log = "";
  let pendingSince = now();
  while (true) {
    if (deploy.status !== shownStatus) {
      output.err(statusLine(deploy));
      if (deploy.status === "pending") pendingSince = now();
      shownStatus = deploy.status;
    }
    const text = newLogText(log, deploy.log);
    if (text) output.err(text.replace(/\n$/, ""));
    log = deploy.log;
    if (!ACTIVE.has(deploy.status)) return deploy;
    if (options.signal?.aborted) {
      output.err(`Stopped waiting; the deploy goes on. Check it with tesseract-controller deploy status ${deploy.id}, stop it with deploy cancel ${deploy.id}`);
      return null;
    }
    if (deploy.status === "pending" && now() - pendingSince > (options.pendingTimeoutMs ?? PENDING_TIMEOUT_MS)) {
      throw new CliError(
        `The Tesseract desktop app did not pick up ${deploy.id}; is it open and connected to this sandbox? It stays queued: tesseract-controller deploy status ${deploy.id}`,
      );
    }
    await delay(options.pollMs ?? POLL_MS, options.signal);
    deploy = await fetchDeploy(config, deploy.id);
  }
}

async function create(config: Config, args: string[], output: Output, options: DeployCliOptions): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      dir: { type: "string" },
      app: { type: "string" },
      port: { type: "string" },
      hostname: { type: "string" },
      create: { type: "boolean", default: false },
      cpus: { type: "string" },
      memory: { type: "string" },
      "no-wait": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 1) throw new CliError(`deploy takes exactly one container name\n\n${DEPLOY_USAGE}`, 2);
  const port = values.port === undefined ? undefined : Number(values.port);
  const cpus = values.cpus === undefined ? undefined : Number(values.cpus);
  const memoryMb = values.memory === undefined ? undefined : Number(values.memory);
  const input = validate(CreateDeploySchema, {
    container: positionals[0],
    path: resolve(options.cwd, values.dir ?? "."),
    ...(values.app !== undefined ? { app: values.app } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(values.hostname !== undefined ? { hostname: values.hostname } : {}),
    ...(values.create ? { create: true } : {}),
    ...(cpus !== undefined ? { cpus } : {}),
    ...(memoryMb !== undefined ? { memoryMb } : {}),
  });
  if (!input.ok) throw new CliError(`Invalid deploy: ${input.error.message}`, 2);
  const created = await callLocalApi<Deploy>(config, "POST", restPaths.deploys(), input.value, CREATE_TIMEOUT_MS);
  if (!created) throw new CliError("Empty deploy response");
  output.err(`deploy ${created.id}: ${created.app} (${created.kind}, ${formatBytes(created.bytes)}) to ${created.container}${created.create ? " (create if missing)" : ""}`);
  if (values["no-wait"]) {
    output.out(values.json ? JSON.stringify(created, null, 2) : created.id);
    return 0;
  }
  const deploy = await follow(config, created, output, options);
  if (!deploy) return EXIT_INTERRUPTED;
  if (values.json) output.out(JSON.stringify(deploy, null, 2));
  if (deploy.status === "deployed") {
    if (!values.json) output.out([`deployed ${deploy.app} to ${deploy.container}`, ...deploy.urls.map((url) => `  ${url}`)].join("\n"));
    return 0;
  }
  throw new CliError(`deploy ${deploy.status}${deploy.error ? `: ${deploy.error}` : ""}`);
}

/** `tesseract-controller deploy …`: asks the desktop host to deploy a workspace directory; the sandbox never reaches Docker itself. */
export async function deploy(config: Config, args: string[], output: Output, options: DeployCliOptions): Promise<number> {
  const [first, ...rest] = args;
  if (first === undefined || first === "--help" || first === "-h") {
    output.out(DEPLOY_USAGE);
    return first === undefined ? 2 : 0;
  }
  const now = (options.now ?? Date.now)();
  switch (first) {
    case "targets":
      return targets(config, rest, output, now);
    case "ls":
      return list(config, rest, output, now);
    case "status":
      return status(config, rest, output, now);
    case "cancel":
      return cancel(config, rest, output);
    default:
      return create(config, args, output, options);
  }
}
