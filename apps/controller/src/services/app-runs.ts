import { join } from "node:path";
import {
  createId,
  isFinalAppRunState,
  LIMITS,
  RUN_TARGET_ACTIONS,
  RUN_TARGET_DEFAULT_PORTS,
  RUN_TARGET_VIEWERS,
  type AppRun,
  type AppRunAction,
  type AppViewer,
  type PackageManager,
  type ProcessInfo,
  type RunTarget,
  type RunTargetInfo,
  type StartAppRun,
} from "@tesseract/protocol";
import { badRequest, conflict, errorMessage, HttpError, notFound, unavailable } from "../core/errors";
import { childEnv, resolveExecutable, run } from "../core/exec";
import { readRegularFile } from "../core/files";
import { probeTcp } from "../core/net";
import { processTree } from "../core/proc";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Config } from "../config";
import type { AndroidLinkService } from "./android-link";
import { isLocalHost } from "./browser";
import type { DisplayService } from "./display";
import type { IdentityService } from "./identity";
import type { LineTransform, ProcessService } from "./processes";
import { detectRunTargetSources, devScript, type ProjectFacts } from "./project-detect";
import type { ProjectService } from "./projects";

export const RUN_TARGET_LABELS: Record<RunTarget, string> = {
  "web-dev": "Web dev server",
  "expo-device": "Expo on the phone",
  "expo-web": "Web",
  "expo-android": "Android emulator",
  "rn-android": "Android emulator",
  "flutter-web": "Web",
  "flutter-linux": "Linux desktop",
  "flutter-android": "Android emulator",
  "electron-dev": "Electron",
  test: "Tests",
};

const FLUTTER_TARGETS = new Set<RunTarget>(["flutter-web", "flutter-linux", "flutter-android"]);
const ANDROID_TARGETS = new Set<RunTarget>(["expo-android", "rn-android", "flutter-android"]);
const DISPLAY_TARGETS = new Set<RunTarget>(["flutter-linux", "electron-dev"]);
const PORT_READY_TARGETS = new Set<RunTarget>(["web-dev", "expo-device", "expo-web"]);
const BUILD_READY_TARGETS = new Set<RunTarget>(["expo-android", "rn-android"]);
const METRO_TARGETS = new Set<RunTarget>(["expo-device", "expo-android", "rn-android"]);

const PORT_SEARCH_SPAN = 100;
const PORT_PROBE_TIMEOUT_MS = 500;
const FLUTTER_REQUEST_TIMEOUT_MS = 30_000;
const COMMAND_TIMEOUT_MS = 10_000;
const EXPO_CONFIG_TIMEOUT_MS = 60_000;
const ERROR_TAIL_LINES = 50;
const BUILD_SUCCESSFUL = "BUILD SUCCESSFUL";
const READY_TIMEOUT_MESSAGE = "Did not become ready within 15 minutes";
const DAEMON_LINE = /^\[\{.*\}\]$/;
const EXPO_SLUG = /^[a-z0-9][a-z0-9-]*$/i;

export type AppRunOptions = {
  readyTimeoutMs?: number;
  readyPollMs?: number;
  metroReloadTimeoutMs?: number;
  flutterRequestTimeoutMs?: number;
};

type Command = string[];

type SpawnPlan = {
  name: string;
  command: Command;
  env: Record<string, string>;
  display: boolean;
  port: number | null;
};

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

type LiveRun = {
  run: AppRun;
  cwd: string;
  facts: ProjectFacts;
  pids: number[];
  stopRequested: boolean;
  failure: string | null;
  buildSucceeded: boolean;
  checking: boolean;
  poll: ReturnType<typeof setInterval> | null;
  readyTimer: ReturnType<typeof setTimeout> | null;
  flutter: { appId: string | null; nextId: number; pending: Map<number, Pending> } | null;
  windowPids: Map<string, number | null>;
  ended: Promise<void>;
  markEnded: () => void;
};

type DaemonMessage = { id?: unknown; event?: unknown; params?: Record<string, unknown>; result?: unknown; error?: unknown };

const badGateway = (message: string) => new HttpError("unavailable", message, 502);

/** The `<pm> run <script>` command; npm and bun need `--` before script arguments, pnpm and yarn pass them as is. */
export function packageScriptCommand(pm: PackageManager | null, script: string, args: string[] = []): Command {
  const manager = pm ?? "npm";
  const separator = args.length > 0 && (manager === "npm" || manager === "bun") ? ["--"] : [];
  return [manager, "run", script, ...separator, ...args];
}

/** Runs a binary of the project's dependencies (`npx` equivalent of the package manager). */
export function packageExecCommand(pm: PackageManager | null, args: string[]): Command {
  switch (pm) {
    case "bun":
      return ["bunx", ...args];
    case "pnpm":
      return ["pnpm", "exec", ...args];
    case "yarn":
      return ["yarn", ...args];
    default:
      return ["npx", ...args];
  }
}

function daemonMessages(line: string): DaemonMessage[] | null {
  const trimmed = line.trim();
  if (!DAEMON_LINE.test(trimmed)) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is DaemonMessage => item !== null && typeof item === "object" && !Array.isArray(item));
  } catch {
    return null;
  }
}

/** Readable log text for a Flutter machine-protocol event, or null when the event is not logged. */
export function flutterEventText(message: DaemonMessage): string | null {
  const params = message.params ?? {};
  const text = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);
  switch (message.event) {
    case "app.log":
      return typeof params.log === "string" ? params.log : null;
    case "daemon.logMessage":
      return typeof params.message === "string" ? params.message : null;
    case "app.progress":
      return text(params.message);
    case "app.started":
      return "App started";
    case "app.stop": {
      const error = text(params.error);
      return error ? `App stopped: ${error}` : "App stopped";
    }
    case "daemon.showMessage": {
      const shown = [text(params.title), text(params.message)].filter((part) => part !== null).join(": ");
      if (!shown) return null;
      return params.level === "error" ? `Error: ${shown}` : shown;
    }
    default:
      return null;
  }
}

/** Trailers package managers print after a failed script; the error line is the one before them. */
const PACKAGE_MANAGER_TRAILERS = [
  /^error: script ".*" exited with code \d+/,
  /^npm (ERR!|error)/,
  /ELIFECYCLE/,
  /ERR_PNPM_/,
  /^error Command failed with exit code/,
  /^info Visit https:\/\/yarnpkg\.com/,
];

function lastLine(lines: { stream: string; text: string }[], stream: string): string | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    const text = line.text.trim();
    if (line.stream === stream && text && !PACKAGE_MANAGER_TRAILERS.some((pattern) => pattern.test(text))) return text;
  }
  return null;
}

export class AppRunService {
  private readonly runs = new Map<string, LiveRun>();
  private readonly readyTimeoutMs: number;
  private readonly readyPollMs: number;
  private readonly metroReloadTimeoutMs: number;
  private readonly flutterRequestTimeoutMs: number;

  constructor(
    private readonly config: Config,
    private readonly hub: EventHub,
    private readonly processes: ProcessService,
    private readonly projects: ProjectService,
    private readonly display: DisplayService,
    private readonly android: AndroidLinkService,
    private readonly identity: IdentityService,
    private readonly logger: Logger,
    options: AppRunOptions = {},
  ) {
    this.readyTimeoutMs = options.readyTimeoutMs ?? LIMITS.appRunReadyTimeoutMs;
    this.readyPollMs = options.readyPollMs ?? LIMITS.appRunReadyPollMs;
    this.metroReloadTimeoutMs = options.metroReloadTimeoutMs ?? LIMITS.metroReloadTimeoutMs;
    this.flutterRequestTimeoutMs = options.flutterRequestTimeoutMs ?? FLUTTER_REQUEST_TIMEOUT_MS;
  }

  async targets(projectId: string): Promise<RunTargetInfo[]> {
    const sources = detectRunTargetSources(this.projects.require(projectId).path);
    return Promise.all(
      sources.map(async ({ target, dir, facts }): Promise<RunTargetInfo> => {
        const reason = await this.unavailableReason(target, facts);
        return {
          target,
          label: dir ? `${RUN_TARGET_LABELS[target]} · ${dir}` : RUN_TARGET_LABELS[target],
          dir,
          available: reason === null,
          reason,
          viewer: RUN_TARGET_VIEWERS[target],
          actions: [...RUN_TARGET_ACTIONS[target]],
        };
      }),
    );
  }

  list(projectId?: string): AppRun[] {
    return [...this.runs.values()]
      .filter((live) => projectId === undefined || live.run.projectId === projectId)
      .map((live) => this.snapshot(live))
      .reverse();
  }

  get(id: string): AppRun {
    return this.snapshot(this.require(id));
  }

  async start(projectId: string, input: StartAppRun): Promise<AppRun> {
    const location = this.projects.require(projectId);
    const { target } = input;
    const source = detectRunTargetSources(location.path).find((entry) => entry.target === target);
    if (!source) throw badRequest(`Run target ${target} is not offered for project ${location.id}`);
    const { facts, dir } = source;
    const reason = await this.unavailableReason(target, facts);
    if (reason) throw unavailable(reason);
    if (ANDROID_TARGETS.has(target)) await this.android.ensureConnected();
    const active = [...this.runs.values()].find(
      (live) => live.run.projectId === location.id && live.run.target === target && !isFinalAppRunState(live.run.state),
    );
    if (active) throw conflict(`A ${target} run of ${location.id} is already ${active.run.state} (${active.run.id})`);

    let markEnded = () => {};
    const ended = new Promise<void>((resolve) => {
      markEnded = resolve;
    });
    const live: LiveRun = {
      run: {
        id: createId("appRun"),
        projectId: location.id,
        target,
        dir,
        state: "starting",
        port: null,
        processIds: [],
        viewer: null,
        actions: [...RUN_TARGET_ACTIONS[target]],
        error: null,
        startedAt: nowIso(),
        readyAt: null,
        endedAt: null,
      },
      cwd: dir ? join(location.path, dir) : location.path,
      facts,
      pids: [],
      stopRequested: false,
      failure: null,
      buildSucceeded: false,
      checking: false,
      poll: null,
      readyTimer: null,
      flutter: FLUTTER_TARGETS.has(target) ? { appId: null, nextId: 0, pending: new Map() } : null,
      windowPids: new Map(),
      ended,
      markEnded,
    };
    this.runs.set(live.run.id, live);
    let plans: SpawnPlan[];
    try {
      live.run.port = await this.choosePort(target, input.port, live.run.id);
      if (isFinalAppRunState(live.run.state)) return this.snapshot(live);
      plans = await this.plan(live);
    } catch (error) {
      this.runs.delete(live.run.id);
      throw error;
    }
    if (isFinalAppRunState(live.run.state)) return this.snapshot(live);
    this.publish(live);
    this.logger.info("app run started", { id: live.run.id, project: location.id, target, dir: dir ?? undefined, port: live.run.port ?? undefined });

    plans.forEach((plan, index) => {
      if (isFinalAppRunState(live.run.state)) return;
      const info = this.processes.spawn({
        projectId: location.id,
        name: plan.name,
        command: plan.command,
        cwd: live.cwd,
        env: plan.env,
        display: plan.display,
        port: plan.port,
        stdin: live.flutter && index === 0 ? "pipe" : undefined,
        transformLine: this.lineTransform(live, index),
        onExit: (exited) => {
          if (!live.run.processIds.includes(exited.id)) live.run.processIds.push(exited.id);
          if (index === 0) this.mainEnded(live, exited);
          else this.helperEnded(live, exited);
        },
      });
      if (info.pid !== null) live.pids.push(info.pid);
      if (!live.run.processIds.includes(info.id)) live.run.processIds.push(info.id);
    });
    this.publish(live);
    if (!isFinalAppRunState(live.run.state)) this.watchReadiness(live);
    return this.snapshot(live);
  }

  async stop(id: string): Promise<AppRun> {
    const live = this.require(id);
    if (isFinalAppRunState(live.run.state)) return this.snapshot(live);
    live.stopRequested = true;
    if (live.run.processIds.length === 0) {
      this.endUnspawned(live);
      return this.snapshot(live);
    }
    await this.stopProcesses(live);
    await live.ended;
    return this.snapshot(live);
  }

  /** A run stopped while start() was still choosing its port or planning: nothing was spawned. */
  private endUnspawned(live: LiveRun): void {
    this.clearTimers(live);
    live.run.state = "stopped";
    live.run.endedAt = nowIso();
    this.logger.info("app run ended", { id: live.run.id, state: live.run.state });
    this.publish(live);
    live.markEnded();
  }

  async action(id: string, action: AppRunAction): Promise<AppRun> {
    const live = this.require(id);
    const { run } = live;
    if (!run.actions.includes(action)) throw conflict(`Run target ${run.target} does not support ${action}`);
    if (run.state !== "ready") throw conflict(`App run ${run.id} is ${run.state}, not ready`);
    if (action === "focus") await this.focus(live);
    else if (live.flutter) await this.flutterRestart(live, action === "restart");
    else if (METRO_TARGETS.has(run.target) && run.port !== null) await this.metroReload(run.port);
    else throw conflict(`Run target ${run.target} does not support ${action}`);
    return this.snapshot(live);
  }

  async shutdown(): Promise<void> {
    for (const live of this.runs.values()) {
      if (isFinalAppRunState(live.run.state)) continue;
      live.stopRequested = true;
      this.clearTimers(live);
    }
  }

  private require(id: string): LiveRun {
    const live = this.runs.get(id);
    if (!live) throw notFound(`App run ${id} not found`);
    return live;
  }

  private snapshot(live: LiveRun): AppRun {
    const { run } = live;
    return { ...run, processIds: [...run.processIds], actions: [...run.actions], viewer: run.viewer ? { ...run.viewer } : null };
  }

  private publish(live: LiveRun): void {
    this.hub.publish({ type: "app.updated", run: this.snapshot(live) });
  }

  private async unavailableReason(target: RunTarget, facts: ProjectFacts): Promise<string | null> {
    if ((FLUTTER_TARGETS.has(target) || (target === "test" && facts.framework === "flutter")) && !this.flutterBin()) {
      return "Flutter SDK is not installed";
    }
    if (ANDROID_TARGETS.has(target)) {
      const reason = this.android.unavailableReason();
      if (reason) return reason;
    }
    if (DISPLAY_TARGETS.has(target) && !(await this.display.status()).available) return `Display ${this.config.display} is not available`;
    return null;
  }

  private flutterBin(): string | null {
    return resolveExecutable(this.config.flutterBin);
  }

  private async choosePort(target: RunTarget, requested: number | undefined, runId: string): Promise<number | null> {
    const first = (RUN_TARGET_DEFAULT_PORTS as Partial<Record<RunTarget, number>>)[target];
    if (first === undefined) return null;
    const claimed = (port: number) =>
      [...this.runs.values()].some((live) => live.run.id !== runId && live.run.port === port && !isFinalAppRunState(live.run.state));
    if (requested !== undefined) {
      if (claimed(requested)) throw conflict(`Port ${requested} is already used by another app run`);
      await this.processes.assertPortFree(requested);
      return requested;
    }
    for (let port = first; port < first + PORT_SEARCH_SPAN && port <= 65_535; port += 1) {
      if (claimed(port)) continue;
      try {
        await this.processes.assertPortFree(port);
        return port;
      } catch {}
    }
    throw conflict(`No free port between ${first} and ${first + PORT_SEARCH_SPAN - 1}`);
  }

  private async phoneHost(): Promise<string | null> {
    const node = await this.identity.selfNode().catch(() => null);
    const ipv4 = node?.tailscaleIps.find((ip) => !ip.includes(":"));
    if (ipv4) return ipv4;
    const host = new URL(this.config.publicUrl).hostname;
    return host && !isLocalHost(host) ? host : null;
  }

  private async plan(live: LiveRun): Promise<SpawnPlan[]> {
    const { run, facts } = live;
    const port = String(run.port ?? "");
    const pm = facts.packageManager;
    const flutter = this.flutterBin() ?? this.config.flutterBin;
    const serial = this.android.runSerial;
    const androidEnv: Record<string, string> = ANDROID_TARGETS.has(run.target) ? { ANDROID_SERIAL: serial } : {};
    const single = (command: Command, env: Record<string, string> = {}): SpawnPlan[] => [
      { name: `${run.target} (${RUN_TARGET_LABELS[run.target]})`, command, env: { ...androidEnv, ...env }, display: DISPLAY_TARGETS.has(run.target), port: run.port },
    ];
    switch (run.target) {
      case "web-dev": {
        const script = devScript(facts.scripts) ?? "dev";
        if (facts.framework === "vite") return single(packageScriptCommand(pm, script, ["--host", "0.0.0.0", "--port", port, "--strictPort"]));
        if (facts.framework === "next") return single(packageScriptCommand(pm, script, ["-H", "0.0.0.0", "-p", port]));
        return single(packageScriptCommand(pm, script), { PORT: port, HOST: "0.0.0.0" });
      }
      case "expo-device": {
        const host = await this.phoneHost();
        const client = facts.deps.has("expo-dev-client") ? "--dev-client" : "--go";
        return single(packageExecCommand(pm, ["expo", "start", "--port", port, client]), {
          CI: "1",
          EXPO_NO_TELEMETRY: "1",
          ...(host ? { REACT_NATIVE_PACKAGER_HOSTNAME: host } : {}),
        });
      }
      case "expo-web":
        return single(packageExecCommand(pm, ["expo", "start", "--web", "--port", port]), { CI: "1", EXPO_NO_TELEMETRY: "1" });
      case "expo-android":
        return single(packageExecCommand(pm, ["expo", "run:android", "--port", port, "--device", serial]), { CI: "1", EXPO_NO_TELEMETRY: "1" });
      case "rn-android":
        return [
          { name: "rn-android (Metro)", command: packageExecCommand(pm, ["react-native", "start", "--port", port]), env: { ...androidEnv, CI: "1" }, display: false, port: run.port },
          {
            name: "rn-android (Gradle build)",
            command: packageExecCommand(pm, ["react-native", "run-android", "--port", port, "--deviceId", serial]),
            env: { ...androidEnv, CI: "1" },
            display: false,
            port: null,
          },
        ];
      case "flutter-web":
        return single([flutter, "run", "--machine", "-d", "web-server", "--web-hostname", "0.0.0.0", "--web-port", port]);
      case "flutter-linux":
        return single([flutter, "run", "--machine", "-d", "linux"]);
      case "flutter-android":
        return single([flutter, "run", "--machine", "-d", serial]);
      case "electron-dev":
        return single(packageScriptCommand(pm, devScript(facts.scripts) ?? "dev"));
      case "test":
        return single(facts.framework === "flutter" ? [flutter, "test"] : packageScriptCommand(pm, "test"), { CI: "1" });
    }
  }

  private lineTransform(live: LiveRun, index: number): LineTransform | undefined {
    const watchBuild = BUILD_READY_TARGETS.has(live.run.target) && (live.run.target === "rn-android" ? index === 1 : index === 0);
    if (live.flutter && index === 0) {
      return (stream, line) => {
        if (stream !== "stdout") return line;
        const messages = daemonMessages(line);
        if (!messages) return line;
        const texts = messages.map((message) => this.onDaemonMessage(live, message)).filter((text): text is string => text !== null);
        return texts.length > 0 ? texts.join("\n") : null;
      };
    }
    if (!watchBuild) return undefined;
    return (_stream, line) => {
      if (!live.buildSucceeded && line.includes(BUILD_SUCCESSFUL)) live.buildSucceeded = true;
      return line;
    };
  }

  private onDaemonMessage(live: LiveRun, message: DaemonMessage): string | null {
    const flutter = live.flutter;
    if (!flutter) return null;
    if (typeof message.id === "number" && message.event === undefined) {
      const pending = flutter.pending.get(message.id);
      if (pending) {
        flutter.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error !== undefined && message.error !== null) pending.reject(new Error(typeof message.error === "string" ? message.error : JSON.stringify(message.error)));
        else pending.resolve(message.result);
      }
      return null;
    }
    const appId = message.params?.appId;
    if ((message.event === "app.start" || message.event === "app.started") && typeof appId === "string") flutter.appId = appId;
    if (message.event === "app.started") void this.markReady(live);
    const stopError = message.event === "app.stop" ? message.params?.error : undefined;
    if (typeof stopError === "string" && stopError && !live.stopRequested) live.failure = stopError;
    return flutterEventText(message);
  }

  private watchReadiness(live: LiveRun): void {
    if (live.run.target === "test") return;
    live.readyTimer = setTimeout(() => {
      if (live.run.state !== "starting") return;
      live.failure = READY_TIMEOUT_MESSAGE;
      void this.stopProcesses(live);
    }, this.readyTimeoutMs);
    if (live.flutter) return;
    live.poll = setInterval(() => void this.checkReady(live), this.readyPollMs);
  }

  private async checkReady(live: LiveRun): Promise<void> {
    if (live.checking || live.run.state !== "starting") return;
    live.checking = true;
    try {
      const { target, port } = live.run;
      let ready = false;
      if (PORT_READY_TARGETS.has(target) && port !== null) ready = await this.portOpen(port);
      else if (BUILD_READY_TARGETS.has(target) && port !== null) ready = live.buildSucceeded && (await this.portOpen(port));
      else if (target === "electron-dev") ready = (await this.windows(live)).length > 0;
      if (ready) await this.markReady(live);
    } finally {
      live.checking = false;
    }
  }

  private async portOpen(port: number): Promise<boolean> {
    const [v4, v6] = await Promise.all([probeTcp("127.0.0.1", port, PORT_PROBE_TIMEOUT_MS), probeTcp("::1", port, PORT_PROBE_TIMEOUT_MS)]);
    return v4 || v6;
  }

  private async markReady(live: LiveRun): Promise<void> {
    if (live.run.state !== "starting") return;
    const viewer = await this.viewer(live);
    if (live.run.state !== "starting") return;
    this.clearTimers(live);
    live.run.state = "ready";
    live.run.readyAt = nowIso();
    live.run.viewer = viewer;
    this.logger.info("app run ready", { id: live.run.id, target: live.run.target });
    this.publish(live);
  }

  private async viewer(live: LiveRun): Promise<AppViewer> {
    const { target, port } = live.run;
    switch (RUN_TARGET_VIEWERS[target]) {
      case "url": {
        const host = await this.phoneHost();
        return { kind: "url", url: host ? `http://${host}:${port}` : null, localUrl: `http://127.0.0.1:${port}` };
      }
      case "deeplink": {
        const host = (await this.phoneHost()) ?? "127.0.0.1";
        const manifestUrl = `http://${host}:${port}`;
        const slug = live.facts.deps.has("expo-dev-client") ? await this.expoSlug(live) : null;
        return {
          kind: "deeplink",
          devClientUrl: slug ? `exp+${slug}://expo-development-client/?url=${encodeURIComponent(manifestUrl)}` : null,
          expoGoUrl: `exp://${host}:${port}`,
          manifestUrl,
        };
      }
      case "display":
        return { kind: "display" };
      case "android":
        return { kind: "android", serial: this.android.runSerial };
      case "none":
        return { kind: "none" };
    }
  }

  private async expoSlug(live: LiveRun): Promise<string | null> {
    const slugOf = (value: unknown): string | null | undefined => {
      const slug = (value as { slug?: unknown } | null)?.slug;
      if (typeof slug !== "string" || !slug) return undefined;
      return EXPO_SLUG.test(slug) ? slug : null;
    };
    const file = readRegularFile(join(live.cwd, "app.json"), { maxBytes: 1024 * 1024, followSymlinks: true });
    if (file) {
      try {
        const slug = slugOf((JSON.parse(file.content) as { expo?: unknown }).expo);
        if (slug !== undefined) return slug;
      } catch {}
    }
    const result = await run(packageExecCommand(live.facts.packageManager, ["expo", "config", "--json", "--type", "public"]), {
      cwd: live.cwd,
      env: { ...childEnv(), CI: "1", EXPO_NO_TELEMETRY: "1" },
      timeoutMs: EXPO_CONFIG_TIMEOUT_MS,
    });
    if (!result.ok) return null;
    try {
      return slugOf(JSON.parse(result.stdout)) ?? null;
    } catch {
      return null;
    }
  }

  private lastError(info: ProcessInfo): string {
    let lines: { stream: string; text: string }[] = [];
    try {
      lines = this.processes.logTail(info.id, ERROR_TAIL_LINES);
    } catch {}
    return lastLine(lines, "stderr") ?? lastLine(lines, "stdout") ?? `Exited with code ${info.exitCode ?? "unknown"}`;
  }

  private mainEnded(live: LiveRun, info: ProcessInfo): void {
    const { run } = live;
    if (isFinalAppRunState(run.state)) return;
    this.clearTimers(live);
    if (live.failure) {
      run.state = "failed";
      run.error = live.failure;
    } else if (live.stopRequested) {
      run.state = "stopped";
    } else if (info.state === "exited") {
      run.state = "exited";
    } else {
      run.state = "failed";
      run.error = this.lastError(info);
    }
    run.endedAt = nowIso();
    for (const pending of live.flutter?.pending.values() ?? []) {
      clearTimeout(pending.timer);
      pending.reject(new Error("The app run ended"));
    }
    live.flutter?.pending.clear();
    this.logger.info("app run ended", { id: run.id, state: run.state });
    this.publish(live);
    live.markEnded();
    void this.stopProcesses(live);
  }

  /** The Gradle side of `rn-android`: a failed build before ready fails the run. */
  private helperEnded(live: LiveRun, info: ProcessInfo): void {
    if (live.run.state !== "starting" || live.stopRequested || info.state === "exited") return;
    live.failure = this.lastError(info);
    void this.stopProcesses(live);
  }

  private async stopProcesses(live: LiveRun): Promise<void> {
    await Promise.all(
      live.run.processIds.map((id) =>
        this.processes.stop(id).catch((error) => this.logger.warn("app run process stop failed", { id, error })),
      ),
    );
  }

  private clearTimers(live: LiveRun): void {
    if (live.poll) clearInterval(live.poll);
    if (live.readyTimer) clearTimeout(live.readyTimer);
    live.poll = null;
    live.readyTimer = null;
  }

  private async flutterRestart(live: LiveRun, fullRestart: boolean): Promise<void> {
    const flutter = live.flutter!;
    const mainId = live.run.processIds[0];
    if (!flutter.appId || !mainId) throw badGateway("The Flutter app id is not known yet");
    flutter.nextId += 1;
    const id = flutter.nextId;
    const request = [{ id, method: "app.restart", params: { appId: flutter.appId, fullRestart, pause: false } }];
    const answered = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        flutter.pending.delete(id);
        reject(new Error(`Flutter did not answer app.restart within ${Math.round(this.flutterRequestTimeoutMs / 1000)} s`));
      }, this.flutterRequestTimeoutMs);
      flutter.pending.set(id, { resolve, reject, timer });
    });
    if (!this.processes.write(mainId, `${JSON.stringify(request)}\n`)) {
      const pending = flutter.pending.get(id);
      if (pending) clearTimeout(pending.timer);
      flutter.pending.delete(id);
      throw badGateway("Could not write to the flutter process");
    }
    let result: unknown;
    try {
      result = await answered;
    } catch (error) {
      throw badGateway(`Flutter ${fullRestart ? "restart" : "reload"} failed: ${errorMessage(error)}`);
    }
    const outcome = result as { code?: unknown; message?: unknown } | null;
    if (outcome && typeof outcome.code === "number" && outcome.code !== 0) {
      throw badGateway(`Flutter ${fullRestart ? "restart" : "reload"} failed: ${typeof outcome.message === "string" ? outcome.message : `code ${outcome.code}`}`);
    }
  }

  private metroReload(port: number): Promise<void> {
    const url = `ws://127.0.0.1:${port}/message`;
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      const finish = (error: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          ws.close();
          reject(badGateway(error));
        } else resolve();
      };
      const timer = setTimeout(() => finish(`Metro at ${url} did not accept a connection within ${this.metroReloadTimeoutMs / 1000} s`), this.metroReloadTimeoutMs);
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ version: 2, method: "reload" }));
        ws.close();
        finish(null);
      });
      ws.addEventListener("error", () => finish(`Could not connect to Metro at ${url}`));
      ws.addEventListener("close", () => finish(`Metro at ${url} closed the connection`));
    });
  }

  /** Visible windows owned by the run's process tree: one `xdotool search` per call, `getwindowpid` only for windows not seen before. */
  private async windows(live: LiveRun): Promise<string[]> {
    const env = { ...childEnv(), DISPLAY: this.config.display };
    const listed = await run(["xdotool", "search", "--onlyvisible", "--name", ".*"], { env, timeoutMs: COMMAND_TIMEOUT_MS });
    if (!listed.ok) return [];
    const ids = listed.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
    await Promise.all(
      ids
        .filter((id) => !live.windowPids.has(id))
        .map(async (id) => {
          const result = await run(["xdotool", "getwindowpid", id], { env, timeoutMs: COMMAND_TIMEOUT_MS });
          const pid = result.ok ? Number.parseInt(result.stdout.trim(), 10) : Number.NaN;
          live.windowPids.set(id, Number.isInteger(pid) ? pid : null);
        }),
    );
    const tree = new Set(processTree(live.pids));
    return ids.filter((id) => {
      const pid = live.windowPids.get(id);
      return pid !== null && pid !== undefined && tree.has(pid);
    });
  }

  private async focus(live: LiveRun): Promise<void> {
    const windows = await this.windows(live);
    const window = windows.at(-1);
    if (!window) throw badGateway("No window of this app run is open on the display");
    const env = { ...childEnv(), DISPLAY: this.config.display };
    const activated = await run(["xdotool", "windowactivate", window], { env, timeoutMs: COMMAND_TIMEOUT_MS });
    if (!activated.ok) throw badGateway(`Could not focus the window: ${(activated.stderr || activated.error || "xdotool failed").trim()}`);
    if (resolveExecutable("wmctrl")) {
      await run(["wmctrl", "-r", ":ACTIVE:", "-b", "add,maximized_vert,maximized_horz"], { env, timeoutMs: COMMAND_TIMEOUT_MS });
    }
  }
}
