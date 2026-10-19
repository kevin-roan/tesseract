import { HostShellClient } from "@tesseract/client";
import type { HostShellState } from "../../shared/contracts/hostShell";
import { HOST_SHELL } from "../host/constants";
import { describeHostError, HostShellError } from "../host/model";
import { HostShellService, type HostShellDeps } from "../host/service";
import { MASTER_HOST_LABELS } from "./labels";
import { masterHostLink, type SavedMasterHost } from "./model";

export type RemoteHostDeps = Pick<HostShellDeps, "onChange" | "fetch" | "now" | "autostart">;

export class RemoteHostShell extends HostShellService {
  constructor(
    readonly target: SavedMasterHost | null,
    deps: RemoteHostDeps,
  ) {
    super({ ...deps, command: () => [], env: () => ({}), platform: process.platform });
  }

  override init(): Promise<HostShellState> {
    return this.refresh();
  }

  override start(): Promise<HostShellState> {
    return this.refresh();
  }

  override setPin(): Promise<HostShellState> {
    return Promise.reject(new HostShellError(MASTER_HOST_LABELS.remoteManaged, "invalid_argument"));
  }

  override rotateToken(): Promise<HostShellState> {
    return Promise.reject(new HostShellError(MASTER_HOST_LABELS.remoteManaged, "invalid_argument"));
  }

  protected override async probe(): Promise<HostShellState> {
    const target = this.target;
    if (!target) {
      this.set({ status: "external", pairing: null, error: MASTER_HOST_LABELS.unlinked });
      return this.state();
    }
    const pairing = { link: masterHostLink(target), url: target.url, name: target.name ?? "", pinSet: false };
    const client = new HostShellClient({
      baseUrl: target.url,
      token: target.token,
      timeoutMs: HOST_SHELL.hostTimeoutMs,
      fetch: this.deps.fetch,
    });
    try {
      const lock = await client.lockStatus();
      this.set({ status: "external", pairing: { ...pairing, pinSet: lock.pinSet }, error: null });
    } catch (error) {
      this.forgetSession();
      this.set({ status: "failed", pairing, error: describeHostError(error, target.url) });
    }
    return this.state();
  }
}
