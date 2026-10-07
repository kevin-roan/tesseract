import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { projectIdFromName } from "@theone/protocol";
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

export async function writePushArchive(root: string, files: string[], file: string): Promise<number> {
  const writer = new TarWriter(file, IS_WINDOWS ? await portableExecutables(root, files) : null);
  let count = 0;
  try {
    for (const path of files) {
      await writer.addPath(join(root, path), path, path === GIT_DIR);
      count += 1;
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
): Promise<{ path: string; created: boolean; count: number; tree: HostTree }> {
  const files = await collectFiles(root);
  const tree = await scanTree(root, files);
  const temp = await mkdtemp(join(tmpdir(), PUSH_TEMP_PREFIX));
  try {
    const archive = join(temp, ARCHIVE_NAME);
    const count = await writePushArchive(root, files, archive);
    const { project, created } = await api.pushProject(projectId, archive, confidential);
    return { path: project.path, created, count, tree };
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => undefined);
  }
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
  let pushed;
  try {
    pushed = await syncDirectory(api, root, projectId, confidential);
  } catch (error) {
    io.stderr(CLI_SYNC_LABELS.syncFailed(errorMessage(error)));
    return EXIT.error;
  }
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
