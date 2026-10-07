import { LIMITS, type SyncRequest } from "@theone/protocol";
import { createLogger } from "../log";
import type { SyncApi } from "./api";
import { SyncBackError, SyncConflict, errorMessage } from "./errors";
import { SYNC_LABELS } from "./labels";
import { runGet } from "./get";
import { pull, pullResult, type SyncResultBody } from "./pull";
import { restoreBaseline, revert, revertResult } from "./revert";
import { redactText, sharedPath, type SyncState } from "./state";
import { describeResult } from "./summary";

export interface Handled {
  request: SyncRequest;
  ok: boolean;
  message: string;
  result: SyncResultBody | SyncRequest["result"] | null;
}

type RequestLike = Pick<SyncRequest, "id" | "projectId" | "status"> & Partial<SyncRequest>;

const log = createLogger("syncback");

export async function claimable(request: Partial<RequestLike>, state: SyncState): Promise<boolean> {
  return request.status === "pending" && typeof request.projectId === "string" && (await state.links()).has(request.projectId);
}

export function emptyResult(hostPath: string | null, conflicts: string[] = []): SyncResultBody {
  return { added: 0, modified: 0, deleted: 0, conflicts, snapshotId: null, hostPath };
}

function finished(done: SyncRequest): Handled {
  const result = done.result;
  if (done.status === "applied") return { request: done, ok: true, message: describeResult("get", { ...(result ?? {}) }), result };
  return { request: done, ok: false, message: done.error || SYNC_LABELS.refused, result };
}

async function fail(api: SyncApi, request: SyncRequest, message: string, result: SyncResultBody): Promise<Handled> {
  const error = message.slice(0, LIMITS.maxStatusMessageLength);
  const body = error ? { status: "failed" as const, result, error } : { status: "failed" as const, result };
  const done = await api.completeRequest(request.id, body);
  return { request: done, ok: false, message, result };
}

async function apply(api: SyncApi, state: SyncState, claimed: SyncRequest): Promise<SyncResultBody> {
  const force = Boolean(claimed.force);
  if (claimed.kind === "revert") {
    const outcome = await revert(state, claimed.projectId, force);
    await restoreBaseline(api, outcome);
    return revertResult(outcome);
  }
  return pullResult(await pull(api, state, claimed.projectId, { paths: claimed.paths ?? null, force }));
}

export async function handleRequest(api: SyncApi, state: SyncState, request: RequestLike, host: string): Promise<Handled> {
  const claimed = await api.claimRequest(request.id, host);
  const link = await state.link(claimed.projectId);
  const hostPath = link ? sharedPath(link) : null;
  const redact = (text: string) => (link ? redactText(link, text) : text);
  let result: SyncResultBody;
  try {
    if (claimed.kind === "get") return finished(await runGet(api, state, claimed));
    result = await apply(api, state, claimed);
  } catch (error) {
    if (error instanceof SyncConflict) return fail(api, claimed, redact(error.message), emptyResult(hostPath, error.conflicts));
    if (error instanceof SyncBackError) log.warn(`sync request ${claimed.id} failed: ${errorMessage(error)}`);
    else log.warn(`sync request ${claimed.id} failed`, error);
    return fail(api, claimed, redact(errorMessage(error)), emptyResult(hostPath));
  }
  if (link?.confidential) result.hostPath = hostPath;
  const done = await api.completeRequest(claimed.id, { status: "applied", result });
  return { request: done, ok: true, message: describeResult(claimed.kind, result), result };
}
