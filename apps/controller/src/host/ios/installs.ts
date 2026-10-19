import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createId, LIMITS, type IosInstallRequest, type IosLinkStage } from "@tesseract/protocol";
import { conflict, errorMessage, notFound } from "../../core/errors";
import type { Logger } from "../../core/logger";
import { bundleId, BUNDLE_MESSAGES, extractArchive, findApp, isSupportedArchive } from "./bundle";
import type { IosConfig } from "./config";
import type { CommandRunner } from "./runner";
import type { SandboxApi } from "./sandbox-api";
import type { Simctl } from "./simctl";

/** Bundle hashes the user approved (`state.json` `iosApprovedBundles`). */
export type ApprovalStore = { approved: () => string[]; approve: (sha256: string) => void };

export type InstallsOptions = { confirmTimeoutMs?: number; maxBytes?: number };

export type Progress = (stage: IosLinkStage) => void;

export const INSTALL_MESSAGES = {
  rejected: "The install was rejected on the host",
  expired: "Nobody confirmed the install in time",
  stopping: "The host daemon is stopping",
  tooLarge: (max: number) => `The artifact is larger than ${max} bytes`,
  notPending: (state: string) => `The install is ${state}, not pending`,
} as const;

const MAX_KEPT = 50;

type Waiter = { resolve: (approved: boolean | null) => void; timer: ReturnType<typeof setTimeout> };

/**
 * Installs sandbox simulator builds. A build whose sha256 was never approved waits as `pending` until the user decides
 * (`POST /v1/ios/installs/:id`, session auth) or it expires; the downloaded file must match the approved hash.
 */
export class IosInstalls {
  private readonly requests: IosInstallRequest[] = [];
  private readonly waiters = new Map<string, Waiter>();
  private readonly confirmTimeoutMs: number;
  private readonly maxBytes: number;

  constructor(
    private readonly config: IosConfig,
    private readonly runner: CommandRunner,
    private readonly simctl: Simctl,
    private readonly approvals: ApprovalStore,
    private readonly tmpDir: () => string,
    private readonly logger: Logger,
    options: InstallsOptions = {},
  ) {
    this.confirmTimeoutMs = options.confirmTimeoutMs ?? LIMITS.iosInstallConfirmTimeoutMs;
    this.maxBytes = options.maxBytes ?? LIMITS.maxIosInstallBytes;
  }

  list(): IosInstallRequest[] {
    return this.requests.map((request) => ({ ...request }));
  }

  decide(id: string, approve: boolean): IosInstallRequest {
    const request = this.requests.find((entry) => entry.id === id);
    if (!request) throw notFound(`Install ${id.slice(0, 80)} not found`);
    const waiter = this.waiters.get(id);
    if (request.state !== "pending" || !waiter) throw conflict(INSTALL_MESSAGES.notPending(request.state));
    if (approve) this.approvals.approve(request.sha256);
    this.update(request, { state: approve ? "approved" : "rejected" });
    this.settle(id, approve);
    return { ...request };
  }

  /** Resolves with the installed bundle id (null when it cannot be read). */
  async install(api: SandboxApi, artifactId: string, udid: string, progress: Progress): Promise<string | null> {
    const artifact = await api.artifact(artifactId);
    if (!isSupportedArchive(artifact.fileName)) throw new Error(BUNDLE_MESSAGES.unsupported);
    if (artifact.sizeBytes > this.maxBytes) throw new Error(INSTALL_MESSAGES.tooLarge(this.maxBytes));
    const known = this.approvals.approved().includes(artifact.sha256);
    const now = Date.now();
    const request: IosInstallRequest = {
      id: createId("iosInstall"),
      artifactId,
      fileName: artifact.fileName,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      udid,
      state: known ? "approved" : "pending",
      bundleId: null,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.confirmTimeoutMs).toISOString(),
      error: null,
    };
    this.requests.unshift(request);
    this.requests.splice(MAX_KEPT);
    if (!known) {
      this.logger.warn("ios install waits for confirmation", { id: request.id, sha256: request.sha256, fileName: request.fileName });
      progress("awaiting_confirmation");
      const decision = await this.wait(request.id);
      if (decision === null) {
        if (request.state === "pending") this.update(request, { state: "expired", error: INSTALL_MESSAGES.expired });
        throw new Error(request.error ?? INSTALL_MESSAGES.expired);
      }
      if (!decision) throw new Error(INSTALL_MESSAGES.rejected);
    }
    const dir = mkdtempSync(join(this.tmpDir(), "ios-install-"));
    try {
      this.update(request, { state: "installing" });
      progress("downloading");
      const archive = join(dir, "artifact");
      await api.download(artifactId, archive, request.sha256, this.maxBytes);
      await extractArchive(this.config, this.runner, archive, request.fileName, join(dir, "x"));
      const app = findApp(join(dir, "x"));
      if (!app) throw new Error(BUNDLE_MESSAGES.noApp);
      const id = await bundleId(this.config, this.runner, app);
      progress("installing");
      await this.simctl.install(udid, app);
      this.update(request, { state: "installed", bundleId: id });
      this.logger.info("ios app installed", { id: request.id, bundleId: id });
      return id;
    } catch (error) {
      this.update(request, { state: "failed", error: errorMessage(error) });
      throw error;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  shutdown(): void {
    for (const request of this.requests) if (request.state === "pending") this.update(request, { state: "failed", error: INSTALL_MESSAGES.stopping });
    for (const id of [...this.waiters.keys()]) this.settle(id, null);
  }

  private wait(id: string): Promise<boolean | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.settle(id, null), this.confirmTimeoutMs);
      timer.unref?.();
      this.waiters.set(id, { resolve, timer });
    });
  }

  private settle(id: string, approved: boolean | null): void {
    const waiter = this.waiters.get(id);
    if (!waiter) return;
    this.waiters.delete(id);
    clearTimeout(waiter.timer);
    waiter.resolve(approved);
  }

  private update(request: IosInstallRequest, change: Partial<IosInstallRequest>): void {
    Object.assign(request, change);
  }
}

