import type { FetchLike } from "@tesseract/client";
import type { HostShellState } from "../../shared/contracts/hostShell";
import type { HostShellService } from "../host/service";
import { hostRouteKey, type HostRoute, type SavedMasterHost } from "./model";
import { RemoteHostShell } from "./remote";

export interface HostRouterDeps {
  local(): HostShellService;
  emit(state: HostShellState): void;
  autostart?(): boolean;
  fetch?: FetchLike;
  now?(): number;
}

export class HostRouter {
  private key = hostRouteKey({ kind: "local" });
  private remote: RemoteHostShell | null = null;

  constructor(private readonly deps: HostRouterDeps) {}

  current(): HostShellService {
    return this.remote ?? this.deps.local();
  }

  isLocal(): boolean {
    return this.remote === null;
  }

  follow(route: HostRoute): boolean {
    const key = hostRouteKey(route);
    if (key === this.key) return false;
    this.key = key;
    const previous = this.remote;
    this.remote = route.kind === "local" ? null : this.create(route.kind === "remote" ? route.host : null);
    if (previous) void previous.lock().catch(() => undefined);
    this.deps.emit(this.current().state());
    if (this.remote) void this.remote.refresh().catch(() => undefined);
    return true;
  }

  localChanged(state: HostShellState): void {
    if (this.isLocal()) this.deps.emit(state);
  }

  private create(target: SavedMasterHost | null): RemoteHostShell {
    const shell: RemoteHostShell = new RemoteHostShell(target, {
      fetch: this.deps.fetch,
      now: this.deps.now,
      autostart: this.deps.autostart?.() === true,
      onChange: (state) => {
        if (this.remote === shell) this.deps.emit(state);
      },
    });
    return shell;
  }
}
