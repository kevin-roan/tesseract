import { basename } from "node:path";
import { projectIdFromName, type SyncChanges } from "@tesseract/protocol";
import { ApiError, TesseractError } from "@tesseract/client";
import { connectSandbox, type CliIo, type SyncEnvironment } from "./connect";
import { EXIT, KIND_CODES, MAX_LISTED, UNKNOWN_KIND_CODE } from "./constants";
import { NotLinked, SyncBackError, SyncConflict, errorMessage } from "./errors";
import { CLI_SYNC_LABELS, SYNC_LABELS } from "./labels";
import { resolveInside, resolvePath } from "./manifest";
import { isConflict, pull, type PullOutcome } from "./pull";
import { restoreBaseline, revert } from "./revert";
import { SyncState, type Link } from "./state";
import { describePull, describeRevert, plural } from "./summary";

type IdFromName = (name: string) => string | null;
type Action = typeof CLI_SYNC_LABELS.actionPush | typeof CLI_SYNC_LABELS.actionSync;

const W = SYNC_LABELS.words;

export async function resolveLink(state: SyncState, cwd: string, idFromName: IdFromName = projectIdFromName): Promise<Link> {
  const root = await resolvePath(cwd);
  const link = await state.linkForPath(root);
  if (link) return link;
  const name = basename(root);
  const projectId = idFromName(name) || name;
  const existing = await state.link(projectId);
  if (existing) throw new SyncBackError(CLI_SYNC_LABELS.linkedElsewhere(projectId, existing.hostPath, root));
  throw new NotLinked(projectId);
}

function list(paths: string[], write: (line: string) => void): void {
  for (const path of paths.slice(0, MAX_LISTED)) write(CLI_SYNC_LABELS.listed(path));
  if (paths.length > MAX_LISTED) write(CLI_SYNC_LABELS.more(paths.length - MAX_LISTED));
}

function reportConflicts(conflicts: string[], action: Action, io: CliIo): number {
  io.stderr(CLI_SYNC_LABELS.conflictHeader(plural(conflicts.length, W.file), action));
  list(conflicts, (line) => io.stderr(line));
  io.stderr(action === CLI_SYNC_LABELS.actionPush ? CLI_SYNC_LABELS.conflictPush : CLI_SYNC_LABELS.conflictSync);
  return EXIT.conflict;
}

function isExpected(error: unknown): boolean {
  return error instanceof SyncBackError || error instanceof TesseractError || (error instanceof Error && "code" in error);
}

function printPlan(outcome: PullOutcome, io: CliIo): void {
  const rows = (["added", "modified", "deleted"] as const).flatMap((kind) => outcome[kind].map((path) => [KIND_CODES[kind] as string, path] as const));
  const conflicts = new Set(outcome.conflicts);
  for (const [code, path] of rows.slice(0, MAX_LISTED)) io.stdout(CLI_SYNC_LABELS.planRow(code, path, conflicts.has(path)));
  if (rows.length > MAX_LISTED) io.stdout(CLI_SYNC_LABELS.more(rows.length - MAX_LISTED));
}

export interface PullCliOptions {
  dryRun: boolean;
  force: boolean;
  idFromName?: IdFromName;
}

export async function runPull(environment: SyncEnvironment, io: CliIo, options: PullCliOptions): Promise<number> {
  const state = new SyncState(environment.stateDir);
  let outcome: PullOutcome;
  try {
    const link = await resolveLink(state, environment.cwd, options.idFromName);
    const connection = await connectSandbox(environment, io);
    if (!connection) return EXIT.error;
    outcome = await pull(connection.api, state, link.projectId, { force: options.force, dryRun: options.dryRun });
  } catch (error) {
    if (error instanceof SyncConflict) return reportConflicts(error.conflicts, CLI_SYNC_LABELS.actionPush, io);
    if (!isExpected(error)) throw error;
    io.stderr(CLI_SYNC_LABELS.pullFailed(errorMessage(error)));
    return EXIT.error;
  }
  io.stdout(describePull(outcome));
  if (options.dryRun) {
    printPlan(outcome, io);
    if (outcome.conflicts.length && !options.force) return reportConflicts(outcome.conflicts, CLI_SYNC_LABELS.actionPush, io);
  } else if (outcome.conflicts.length) {
    io.stdout(CLI_SYNC_LABELS.overwrotePull(plural(outcome.conflicts.length, W.hostEdit)));
  }
  for (const warning of outcome.warnings) io.stderr(CLI_SYNC_LABELS.warning(warning));
  return EXIT.ok;
}

export interface RevertCliOptions {
  force: boolean;
  idFromName?: IdFromName;
}

export async function runRevert(environment: SyncEnvironment, io: CliIo, options: RevertCliOptions): Promise<number> {
  const state = new SyncState(environment.stateDir);
  let link: Link;
  let outcome;
  try {
    link = await resolveLink(state, environment.cwd, options.idFromName);
    outcome = await revert(state, link.projectId, options.force);
  } catch (error) {
    if (error instanceof SyncConflict) return reportConflicts(error.conflicts, CLI_SYNC_LABELS.actionSync, io);
    if (!isExpected(error)) throw error;
    io.stderr(CLI_SYNC_LABELS.revertFailed(errorMessage(error)));
    return EXIT.error;
  }
  if (outcome.baseline.length) {
    const connection = await connectSandbox(environment, io).catch(() => null);
    await restoreBaseline(connection?.api ?? null, outcome);
  }
  io.stdout(describeRevert(outcome));
  if (outcome.displaced.length) io.stdout(CLI_SYNC_LABELS.overwroteRevert(plural(outcome.displaced.length, W.hostEdit), outcome.displacedDir));
  for (const warning of outcome.warnings) io.stderr(CLI_SYNC_LABELS.warning(warning));
  const remaining = (await state.snapshots(link.projectId)).filter((snapshot) => !snapshot.reverted);
  if (remaining.length) io.stdout(CLI_SYNC_LABELS.revertAgain((remaining[0] as (typeof remaining)[number]).id));
  return EXIT.ok;
}

async function printChanges(data: SyncChanges, link: Link, io: CliIo): Promise<void> {
  if (data.baselineAt == null) {
    io.stdout(CLI_SYNC_LABELS.noBaseline);
    return;
  }
  const changes = data.changes ?? [];
  if (!changes.length) {
    io.stdout(CLI_SYNC_LABELS.noChanges);
    return;
  }
  io.stdout(CLI_SYNC_LABELS.changesHeader(changes.length));
  for (const change of changes.slice(0, MAX_LISTED)) {
    let conflict: boolean;
    try {
      conflict = await isConflict(await resolveInside(link.hostPath, change.path), link.manifest[change.path] ?? null, change.sha256 ?? null);
    } catch (error) {
      if (!(error instanceof SyncBackError)) throw error;
      conflict = true;
    }
    io.stdout(CLI_SYNC_LABELS.planRow(KIND_CODES[change.kind] ?? UNKNOWN_KIND_CODE, change.path, conflict));
  }
  if (changes.length > MAX_LISTED) io.stdout(CLI_SYNC_LABELS.more(changes.length - MAX_LISTED));
  io.stdout(CLI_SYNC_LABELS.pullHint);
}

export async function runStatus(environment: SyncEnvironment, io: CliIo, options: { idFromName?: IdFromName } = {}): Promise<number> {
  const state = new SyncState(environment.stateDir);
  let link: Link;
  try {
    link = await resolveLink(state, environment.cwd, options.idFromName);
  } catch (error) {
    if (!(error instanceof SyncBackError)) throw error;
    io.stderr(CLI_SYNC_LABELS.prefix(error.message));
    return EXIT.error;
  }
  io.stdout(CLI_SYNC_LABELS.status(link.projectId, link.hostPath, link.pushedAt, link.gotAt));
  let code: number = EXIT.ok;
  const connection = await connectSandbox(environment, io);
  if (!connection) {
    code = EXIT.error;
  } else {
    try {
      await printChanges(await connection.api.syncChanges(link.projectId), link, io);
    } catch (error) {
      if (!isExpected(error) && !(error instanceof ApiError)) throw error;
      io.stderr(CLI_SYNC_LABELS.changesFailed(errorMessage(error)));
      code = EXIT.error;
    }
  }
  const snapshots = await state.snapshots(link.projectId);
  io.stdout(snapshots.length ? CLI_SYNC_LABELS.snapshotsHeader(snapshots.length) : CLI_SYNC_LABELS.noSnapshots);
  for (const snapshot of snapshots) io.stdout(CLI_SYNC_LABELS.snapshotRow(snapshot.id, plural(snapshot.entries.length, W.file), snapshot.reverted));
  return code;
}
