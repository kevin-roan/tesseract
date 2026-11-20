import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { projectIdFromName } from "@tesseract/protocol";
import { formatBytes } from "../attachments/model";
import type { SyncApi } from "./api";
import { connectSandbox, type CliIo, type SyncEnvironment } from "./connect";
import { EXIT, GIT_DIR, PUSH_TEMP_PREFIX } from "./constants";
import { errorMessage } from "./errors";
import { CLI_SYNC_LABELS } from "./labels";
import { resolvePath } from "./manifest";
import { pseudonym } from "./pseudonym";
import { SyncState, iso, newLink } from "./state";
import { TarWriter } from "./tar";
import { IS_WINDOWS } from "./fsutil";
import { collectFiles, portableExecutables, scanTree, type HostTree } from "./tree";

const ARCHIVE_NAME = "push.tar.gz";

/** What `syncDirectory` is doing; `sent`/`size` are archive bytes. */
export type PushProgress =
  | { stage: "scan" }
  | { stage: "pack"; done: number; total: number }
  | { stage: "upload"; sent: number; size: number }
  | { stage: "unpack"; size: number };

export async function writePushArchive(root: string, files: string[], file: string, onFile?: (done: number) => void): Promise<number> {
  const writer = new TarWriter(file, IS_WINDOWS ? await portableExecutables(root, files) : null);
  let count = 0;
  try {
    for (const path of files) {
      await writer.addPath(join(root, path), path, path === GIT_DIR);
      count += 1;
      onFile?.(count);
    }
    await writer.close();
  } catch (error) {
    await writer.abort();
    throw error;
  }
  return count;
}

export async function syncDirectory(
  api: SyncApi,
  root: string,
  projectId: string,
  confidential: boolean,
  onProgress: (progress: PushProgress) => void = () => undefined,
): Promise<{ path: string; created: boolean; count: number; tree: HostTree }> {
  onProgress({ stage: "scan" });
  const files = await collectFiles(root);
  const tree = await scanTree(root, files);
  const temp = await mkdtemp(join(tmpdir(), PUSH_TEMP_PREFIX));
  try {
    const archive = join(temp, ARCHIVE_NAME);
    onProgress({ stage: "pack", done: 0, total: files.length });
    const count = await writePushArchive(root, files, archive, (done) => onProgress({ stage: "pack", done, total: files.length }));
    const { project, created } = await api.pushProject(projectId, archive, confidential, (sent, size) =>
      onProgress(sent < size ? { stage: "upload", sent, size } : { stage: "unpack", size }),
    );
    return { path: project.path, created, count, tree };
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => undefined);
  }
}

const PROGRESS_MIN_MS = 100;
const TICK_MS = 1000;

export function pushProgressLine(progress: PushProgress, label: string, elapsedMs: number): string {
  const L = CLI_SYNC_LABELS.progress;
  switch (progress.stage) {
    case "scan":
      return L.scan;
    case "pack":
      return L.pack(progress.done, progress.total, percent(progress.done, progress.total));
    case "upload":
      return L.upload(formatBytes(progress.sent), formatBytes(progress.size), percent(progress.sent, progress.size), label);
    case "unpack":
      return L.unpack(formatBytes(progress.size), label, Math.floor(elapsedMs / TICK_MS));
  }
}

const percent = (done: number, total: number) => (total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0);

/**
 * One line rewritten in place on a terminal: at most every 100 ms, and every second while the sandbox unpacks
 * (so the elapsed time moves). Without a terminal nothing is shown, keeping piped output as it was.
 */
function pushProgress(io: CliIo, label: string, now: () => number = Date.now) {
  let last = 0;
  let current: PushProgress | null = null;
  let since = now();
  let timer: ReturnType<typeof setInterval> | null = null;
  const render = () => {
    if (!current || !io.progress) return;
    last = now();
    io.progress(pushProgressLine(current, label, now() - since));
  };
  return {
    update: (progress: PushProgress) => {
      if (!io.progress) return;
      const changed = progress.stage !== current?.stage;
      if (changed) since = now();
      current = progress;
      if (progress.stage === "unpack" && !timer) {
        timer = setInterval(render, TICK_MS);
        timer.unref?.();
      }
      if (changed || now() - last >= PROGRESS_MIN_MS) render();
    },
    done: () => {
      if (timer) clearInterval(timer);
      timer = null;
      io.progress?.(null);
    },
  };
}

async function sandboxProjectIds(api: SyncApi): Promise<string[]> {
  try {
    return await api.projectIds();
  } catch {
    return [];
  }
}

export async function runPush(environment: SyncEnvironment, io: CliIo, options: { confidential: boolean }): Promise<number> {
  const root = await resolvePath(environment.cwd);
  const state = new SyncState(environment.stateDir);
  let link = await state.linkForPath(root);
  let confidential = options.confidential;
  let replaces: string | null = null;
  if (link && confidential && !link.confidential) {
    replaces = link.projectId;
    link = null;
  }
  let projectId: string | null;
  if (link) {
    projectId = link.projectId;
    confidential = link.confidential;
  } else {
    projectId = confidential ? null : projectIdFromName(basename(root));
  }
  if (!projectId && !confidential) {
    io.stderr(CLI_SYNC_LABELS.cannotDerive(basename(root)));
    return EXIT.error;
  }
  const connection = await connectSandbox(environment, io);
  if (!connection) return EXIT.error;
  const { api, label } = connection;
  if (!projectId) projectId = pseudonym([...(await state.links()).keys(), ...(await sandboxProjectIds(api))]);
  io.stdout(CLI_SYNC_LABELS.syncing(root, projectId, confidential, label));
  const progress = pushProgress(io, label);
  let pushed;
  try {
    pushed = await syncDirectory(api, root, projectId, confidential, progress.update);
  } catch (error) {
    progress.done();
    io.stderr(CLI_SYNC_LABELS.syncFailed(errorMessage(error)));
    return EXIT.error;
  }
  progress.done();
  try {
    const { manifest, executable, git } = pushed.tree;
    await state.saveLink(
      newLink({ projectId, hostPath: root, pushedAt: iso(new Date()), manifest, executable, gitManifest: git, confidential }),
      replaces,
    );
  } catch (error) {
    io.stderr(CLI_SYNC_LABELS.linkFailed(errorMessage(error)));
  }
  io.stdout(CLI_SYNC_LABELS.pushed(pushed.created, pushed.path, pushed.count));
  if (replaces) io.stderr(CLI_SYNC_LABELS.replaced(replaces));
  return EXIT.ok;
}
