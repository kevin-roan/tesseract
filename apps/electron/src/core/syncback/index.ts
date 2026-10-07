import type { HostChange, SnapshotSummary, SyncLinkSummary } from "../../shared/contracts/syncback";
import type { FileDiff as FileDiffContract } from "../../shared/contracts/syncback";
import { connectSandbox, type CliIo, type SyncEnvironment } from "./connect";
import { NotConfiguredError } from "./describe";
import { previewDiff, toContractDiff } from "./diff";
import { hostChangeList } from "./get";
import type { DigestCache } from "./manifest";
import { SyncState } from "./state";

export { SYNC_STATE, HEARTBEAT_INTERVAL_MS, EXIT } from "./constants";
export { HttpSyncApi, type SyncApi, type ByteStream, type PushResult } from "./api";
export { connectSandbox, connectionFor, resolveConnection, type CliIo, type SyncConnection, type SyncEnvironment } from "./connect";
export { describeError, NotConfiguredError, isAuthError } from "./describe";
export { diffFile as diffBytes, extractMember, previewDiff, readHostFile, toContractDiff, type FileDiff as RawFileDiff } from "./diff";
export { NotLinked, SyncBackError, SyncConflict, TooLarge } from "./errors";
export { hostChangeList, planChanges, planGit, runGet, writeGetArchive } from "./get";
export { DigestCache, buildManifest, checkRelative, hashPath, resolveInside } from "./manifest";
export { pseudonym } from "./pseudonym";
export { pull, pullResult, requireLink, type PullOutcome } from "./pull";
export { runPush, syncDirectory } from "./push";
export { claimable, emptyResult, handleRequest, type Handled } from "./requests";
export { restoreBaseline, revert, revertResult, type RevertOutcome } from "./revert";
export { SyncBackService, notificationKind, type SyncBackServiceOptions } from "./service";
export { SyncState, iso, type Link, type Snapshot } from "./state";
export { breakdown, describeGet, describePull, describeResult, describeRevert, plural } from "./summary";
export { collectFiles, contained, gitManifest, scanTree } from "./tree";
export { runPull, runRevert, runStatus, resolveLink } from "./cli";

export function syncState(environment: Pick<SyncEnvironment, "stateDir">): SyncState {
  return new SyncState(environment.stateDir);
}

export async function readLinks(environment: SyncEnvironment): Promise<SyncLinkSummary[]> {
  const links = await syncState(environment).links();
  return [...links.values()].map((link) => ({
    projectId: link.projectId,
    hostPath: link.hostPath,
    pushedAt: link.pushedAt || null,
    gotAt: link.gotAt,
    confidential: link.confidential,
    files: Object.keys(link.manifest).length,
  }));
}

export async function listSnapshots(environment: SyncEnvironment, projectId: string): Promise<SnapshotSummary[]> {
  return (await syncState(environment).snapshots(projectId)).map((snapshot) => ({
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    entries: snapshot.entries.length,
    reverted: snapshot.reverted,
    kind: snapshot.kind,
  }));
}

export async function hostChanges(environment: SyncEnvironment, projectId: string, digests?: DigestCache): Promise<HostChange[]> {
  const link = await syncState(environment).link(projectId);
  if (!link) return [];
  return (await hostChangeList(link, digests)).map(({ path, kind }) => ({ path, kind }));
}

export async function diffFile(environment: SyncEnvironment, projectId: string, path: string, io?: CliIo): Promise<FileDiffContract> {
  const silent: CliIo = { stdout: () => undefined, stderr: () => undefined };
  const connection = await connectSandbox(environment, io ?? silent);
  if (!connection) throw new NotConfiguredError();
  return toContractDiff(path, await previewDiff(connection.api, syncState(environment), projectId, path));
}
