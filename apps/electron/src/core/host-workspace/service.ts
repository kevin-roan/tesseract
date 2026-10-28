import type { HostWorkspaceTarget } from "../../shared/contracts/hostShell";
import { workspaceAccountIds } from "./accounts";
import { HOST_WORKSPACE } from "./constants";
import {
  ensureWorkspaceRunning,
  linkRepo,
  pairingToken,
  readPairing,
  runningAccountIds,
  stopWorkspace,
  type WorkspacePairing,
  type WorkspaceRunner,
} from "./runner";

export interface WorkspaceLink {
  projectId: string;
  hostPath: string;
}

export interface HostWorkspaceDeps {
  runner(): Promise<WorkspaceRunner> | WorkspaceRunner;
  links(): Promise<readonly WorkspaceLink[]>;
  warn?(message: string): void;
}

/**
 * Keeps every synced project's host copy linked into the host workspace controller under the sandbox
 * project's id, so the desktop and the phone can run Claude chats on this computer for it.
 */
export class HostWorkspaceService {
  private pairing: WorkspacePairing | null = null;
  private linked = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: HostWorkspaceDeps) {}

  /** Links `hostPath` as `projectId`, starts the controller when needed and returns how to reach it. */
  open(link: WorkspaceLink): Promise<HostWorkspaceTarget> {
    return this.serialized(async () => {
      const runner = await this.deps.runner();
      await this.link(runner, link);
      return this.target(runner, link.projectId);
    });
  }

  /** Links every synced project; starts the controller when there is at least one. Failures are logged, not thrown. */
  syncAll(): Promise<void> {
    return this.serialized(async () => {
      try {
        const links = await this.deps.links();
        if (links.length === 0) return;
        const runner = await this.deps.runner();
        for (const link of links) await this.link(runner, link);
        await this.ensureCurrent(runner, await this.readPairing(runner));
      } catch (error) {
        this.deps.warn?.(`host workspace sync failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private async link(runner: WorkspaceRunner, { projectId, hostPath }: WorkspaceLink): Promise<void> {
    if (this.linked.get(projectId) === hostPath) return;
    await linkRepo(runner, hostPath, { id: projectId });
    this.linked.set(projectId, hostPath);
  }

  private async readPairing(runner: WorkspaceRunner): Promise<WorkspacePairing> {
    this.pairing ??= await readPairing(runner);
    return this.pairing;
  }

  private async target(runner: WorkspaceRunner, projectId: string): Promise<HostWorkspaceTarget> {
    const pairing = await this.readPairing(runner);
    await this.ensureCurrent(runner, pairing);
    return { projectId, apiUrl: pairing.localUrl, token: pairingToken(pairing), name: pairing.name };
  }

  /** Starts the controller, or restarts it when it runs with other Claude accounts than the sandbox has now. */
  private async ensureCurrent(runner: WorkspaceRunner, pairing: WorkspacePairing): Promise<void> {
    if (await ensureWorkspaceRunning(runner, pairing.localUrl)) return;
    const expected = workspaceAccountIds(runner.env[HOST_WORKSPACE.accountsEnv] ?? "");
    const running = await runningAccountIds(pairing.localUrl, pairingToken(pairing));
    if (running === null || [...running].sort().join() === [...expected].sort().join()) return;
    await stopWorkspace(runner, pairing.localUrl);
    await ensureWorkspaceRunning(runner, pairing.localUrl);
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
