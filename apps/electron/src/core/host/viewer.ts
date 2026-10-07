import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { EmulatorViewerRequest } from "../../shared/contracts/hostShell";
import { findExecutable, nodeFileProbe, type FileProbe } from "./command";
import { VIEWER } from "./constants";
import { viewerEnv, type HostEnv } from "./env";
import { HOST_LABELS } from "./labels";
import { HostShellError, viewerError } from "./model";
import type { SpawnFn } from "./service";

export interface EmulatorViewerDeps {
  env(): HostEnv | Promise<HostEnv>;
  platform: NodeJS.Platform;
  spawn?: SpawnFn;
  files?: FileProbe;
  earlyExitMs?: number;
}

type Outcome = { code: number | null } | { error: Error };

export function viewerArgs(request: EmulatorViewerRequest): string[] {
  return ["--serial", request.serial, "--window-title", request.title, "--no-audio"];
}

export class EmulatorViewer {
  private child: ChildProcess | null = null;
  private stderr: string[] = [];

  constructor(private readonly deps: EmulatorViewerDeps) {}

  running(): boolean {
    return this.child !== null;
  }

  lastError(): string[] {
    return [...this.stderr];
  }

  async open(request: EmulatorViewerRequest): Promise<void> {
    if (this.child) return;
    if (!request.serial) throw new HostShellError(HOST_LABELS.noSerial, "invalid_argument");
    const env = viewerEnv(await this.deps.env());
    const scrcpy = findExecutable(VIEWER.binary, env, this.deps.platform, this.deps.files ?? nodeFileProbe);
    if (!scrcpy) throw new HostShellError(HOST_LABELS.scrcpyMissing, "not_found");
    const child = (this.deps.spawn ?? spawn)(scrcpy, viewerArgs(request), {
      detached: this.deps.platform !== "win32",
      stdio: ["ignore", "ignore", "pipe"],
      env,
    });
    this.child = child;
    this.stderr = [];
    if (child.stderr) {
      createInterface({ input: child.stderr, crlfDelay: Infinity }).on("line", (line) => {
        this.stderr = [...this.stderr, line].slice(-VIEWER.stderrLines);
      });
    }
    const outcome = new Promise<Outcome>((resolve) => {
      child.once("close", (code) => resolve({ code }));
      child.once("error", (error) => resolve({ error }));
    });
    void outcome.then(() => {
      if (this.child === child) this.child = null;
    });
    const early = await Promise.race([
      outcome,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), this.deps.earlyExitMs ?? VIEWER.earlyExitMs)),
    ]);
    if (!early) return;
    if ("error" in early) throw new HostShellError(early.error.message, "internal");
    if (early.code !== 0) throw new HostShellError(viewerError(this.stderr, early.code, HOST_LABELS.scrcpyExited), "internal");
  }
}
