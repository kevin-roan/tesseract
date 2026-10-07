import { readFileSync } from "node:fs";
import type {
  AgentRun,
  BuildJob,
  IslandCommand,
  IslandRun,
  IslandState,
  LiveActivityToken,
  ProcessInfo,
  RegisterLiveActivity,
  ServerEvent,
  UsageReport,
} from "@theone/protocol";
import type { Config } from "../config";
import { notFound } from "../core/errors";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import { APNS_HOSTS, ApnsTokenSigner, Http2ApnsTransport, loadApnsKey, type ApnsRequest, type ApnsTransport } from "./apns";
import { PUSH_TITLE } from "./push";

export type IslandSources = {
  /** Every stored agent run (the running ones become `runs`, the rest count towards `runsToday`). */
  runs: () => AgentRun[];
  processes: () => ProcessInfo[];
  builds: () => BuildJob[];
  usage: (days: number) => Promise<UsageReport>;
  projectName: (projectId: string) => Promise<string | null>;
  sandboxName: () => Promise<string | null>;
};

export type LiveActivityOptions = {
  transport?: ApnsTransport;
  debounceMs?: number;
  /** Seconds after `end` when iOS removes the activity. */
  dismissAfterSec?: number;
  /** Seconds after which iOS shows the content as stale. */
  staleAfterSec?: number;
  now?: () => number;
};

export type ActivityEvent = "start" | "update" | "end";

const DEFAULT_DEBOUNCE_MS = 1_000;
const DEFAULT_DISMISS_AFTER_SEC = 5 * 60;
const DEFAULT_STALE_AFTER_SEC = 2 * 60;
const TITLE_LIMIT = 60;
const ATTRIBUTES_TYPE = "IslandAttributes";
const WATCHED: ReadonlySet<ServerEvent["type"]> = new Set(["agent.updated", "agent.deleted", "process.updated", "build.updated"]);
const GONE_REASONS = new Set(["BadDeviceToken", "Unregistered", "ExpiredToken"]);
const RUN_STATES: Record<AgentRun["state"], IslandRun["state"]> = { running: "running", succeeded: "completed", failed: "failed", cancelled: "cancelled" };

export function runTitle(prompt: string): string {
  const line = prompt.split(/\r?\n/).map((part) => part.trim()).find(Boolean) ?? "";
  return line.length > TITLE_LIMIT ? `${line.slice(0, TITLE_LIMIT - 1).trimEnd()}…` : line;
}

const commandOf = (process: ProcessInfo): IslandCommand => ({ id: process.id, label: process.name, project: process.projectId, state: process.state });
const buildCommandOf = (build: BuildJob): IslandCommand => ({ id: build.id, label: `${build.target} build (${build.profile})`, project: build.projectId, state: build.state });

/**
 * Keeps the `IslandState` of the sandbox and mirrors it into the phone's Live Activity through ActivityKit pushes:
 * `update`/`end` for registered activity tokens, `start` through the push-to-start token when a run begins.
 */
export class LiveActivityService {
  private readonly transport: ApnsTransport;
  private readonly debounceMs: number;
  private readonly dismissAfterSec: number;
  private readonly staleAfterSec: number;
  private readonly now: () => number;
  private readonly signer: ApnsTokenSigner | null;
  private readonly host: string;
  private readonly topic: string;
  private current: IslandState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Promise<void> = Promise.resolve();
  private dirty = false;
  private unsubscribe: (() => void) | null = null;
  private readonly projectNames = new Map<string, Promise<string | null>>();

  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly sources: IslandSources,
    private readonly logger: Logger,
    options: LiveActivityOptions = {},
  ) {
    this.transport = options.transport ?? new Http2ApnsTransport();
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.dismissAfterSec = options.dismissAfterSec ?? DEFAULT_DISMISS_AFTER_SEC;
    this.staleAfterSec = options.staleAfterSec ?? DEFAULT_STALE_AFTER_SEC;
    this.now = options.now ?? Date.now;
    this.host = APNS_HOSTS[config.apns.environment];
    this.topic = `${config.apns.bundleId}.push-type.liveactivity`;
    this.signer = this.createSigner();
  }

  get enabled(): boolean {
    return this.signer !== null;
  }

  register(input: RegisterLiveActivity): LiveActivityToken {
    const now = new Date(this.now()).toISOString();
    const record = this.repos.saveLiveActivityToken({ kind: input.kind, token: input.token.toLowerCase(), activityId: input.activityId, createdAt: now, updatedAt: now });
    if (input.kind === "activity" && this.current) void this.push(this.current, [record], this.active(this.current) ? "update" : "end");
    return record;
  }

  unregister(token: string): LiveActivityToken {
    const record = this.repos.deleteLiveActivityTokens([token.toLowerCase()])[0];
    if (!record) throw notFound("Live Activity token not found");
    return record;
  }

  list(): LiveActivityToken[] {
    return this.repos.liveActivityTokens();
  }

  state(): IslandState | null {
    return this.current;
  }

  /** Follows run, process and build events; changes are pushed after a short debounce. */
  start(hub: EventHub): void {
    this.unsubscribe?.();
    this.unsubscribe = hub.subscribe((event) => {
      if (WATCHED.has(event.type)) this.schedule();
    });
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.pending;
    this.transport.close();
  }

  /** Recomputes the state now and pushes it when it changed. Returns the new state. */
  async refresh(): Promise<IslandState> {
    const previous = this.current;
    const next = await this.compute();
    this.current = next;
    if (previous && sameContent(previous, next)) return next;
    await this.dispatch(previous, next);
    return next;
  }

  async compute(): Promise<IslandState> {
    const nowMs = this.now();
    const today = new Date(nowMs).toISOString().slice(0, 10);
    const allRuns = this.sources.runs();
    const runs = await Promise.all(
      allRuns
        .filter((run) => run.state === "running")
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        .map(async (run) => ({
          id: run.id,
          title: runTitle(run.prompt),
          project: run.projectId === null ? null : await this.projectName(run.projectId),
          state: RUN_STATES[run.state],
          startedAt: run.startedAt,
          tokens: run.usage?.totalTokens ?? null,
        })),
    );
    const commands = [
      ...this.sources.processes().filter((process) => process.state === "starting" || process.state === "running").map(commandOf),
      ...this.sources.builds().filter((build) => build.state === "queued" || build.state === "running").map(buildCommandOf),
    ];
    const usage = await this.usage(today);
    usage.runsToday = allRuns.filter((run) => run.startedAt.slice(0, 10) === today).length;
    return {
      sandboxId: this.config.sandboxId,
      sandboxName: (await this.sources.sandboxName().catch(() => null)) ?? this.config.hostname,
      runs,
      commands,
      usage,
      updatedAt: new Date(nowMs).toISOString(),
    };
  }

  private schedule(): void {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pending = this.pending.then(() => this.flush());
    }, this.debounceMs);
  }

  private async flush(): Promise<void> {
    while (this.dirty) {
      this.dirty = false;
      try {
        await this.refresh();
      } catch (error) {
        this.logger.warn("live activity refresh failed", { error });
      }
    }
  }

  private async usage(today: string): Promise<IslandState["usage"]> {
    try {
      const report = await this.sources.usage(7);
      const day = report.daily.find((entry) => entry.date === today);
      return { todayTokens: day?.totalTokens ?? 0, weekTokens: report.totals.totalTokens, runsToday: 0, messagesToday: day?.messages ?? 0 };
    } catch (error) {
      this.logger.debug("usage unavailable for the live activity", { error });
      return { todayTokens: 0, weekTokens: 0, runsToday: 0, messagesToday: 0 };
    }
  }

  private projectName(projectId: string): Promise<string | null> {
    let name = this.projectNames.get(projectId);
    if (!name) {
      name = this.sources.projectName(projectId).catch(() => null);
      this.projectNames.set(projectId, name);
      setTimeout(() => this.projectNames.delete(projectId), 60_000).unref?.();
    }
    return name;
  }

  private active(state: IslandState): boolean {
    return state.runs.length > 0 || state.commands.length > 0;
  }

  private async dispatch(previous: IslandState | null, next: IslandState): Promise<void> {
    if (!this.signer) {
      this.logger.debug("live activity changed; APNs is not configured", { runs: next.runs.length, commands: next.commands.length });
      return;
    }
    const tokens = this.repos.liveActivityTokens();
    const activities = tokens.filter((record) => record.kind === "activity");
    if (activities.length > 0) {
      await this.push(next, activities, this.active(next) ? "update" : "end");
      return;
    }
    const known = new Set(previous?.runs.map((run) => run.id) ?? []);
    const started = next.runs.find((run) => !known.has(run.id));
    const starters = tokens.filter((record) => record.kind === "push-to-start");
    if (started && starters.length > 0) await this.push(next, starters, "start", started);
  }

  private async push(state: IslandState, tokens: readonly LiveActivityToken[], event: ActivityEvent, started?: IslandRun): Promise<void> {
    if (!this.signer) return;
    const body = JSON.stringify(this.payload(state, event, started));
    const authorization = `bearer ${this.signer.token()}`;
    const gone: string[] = [];
    for (const record of tokens) {
      const request: ApnsRequest = {
        host: this.host,
        path: `/3/device/${record.token}`,
        headers: {
          authorization,
          "apns-topic": this.topic,
          "apns-push-type": "liveactivity",
          "apns-priority": "10",
          "apns-expiration": "0",
        },
        body,
      };
      try {
        const response = await this.transport.send(request);
        if (response.status >= 200 && response.status < 300) continue;
        const reason = reasonOf(response.body);
        if (response.status === 410 || (response.status === 400 && reason !== null && GONE_REASONS.has(reason))) gone.push(record.token);
        else this.logger.warn("live activity push rejected", { event, kind: record.kind, status: response.status, reason });
      } catch (error) {
        this.logger.warn("apns unreachable", { event, host: this.host, error });
      }
    }
    if (event === "end") gone.push(...tokens.filter((record) => record.kind === "activity" && !gone.includes(record.token)).map((record) => record.token));
    const removed = this.repos.deleteLiveActivityTokens(gone);
    if (removed.length > 0) this.logger.info("removed live activity tokens", { count: removed.length, event });
    this.logger.debug("live activity pushed", { event, tokens: tokens.length, removed: removed.length });
  }

  private payload(state: IslandState, event: ActivityEvent, started?: IslandRun): Record<string, unknown> {
    const timestamp = Math.floor(this.now() / 1000);
    const aps: Record<string, unknown> = { timestamp, event, "content-state": state };
    if (event === "end") aps["dismissal-date"] = timestamp + this.dismissAfterSec;
    else aps["stale-date"] = timestamp + this.staleAfterSec;
    if (event === "start") {
      aps["attributes-type"] = ATTRIBUTES_TYPE;
      aps.attributes = { sandboxId: state.sandboxId, sandboxName: state.sandboxName };
      aps.alert = {
        title: PUSH_TITLE,
        subtitle: started?.project ? `${started.project} · Claude started` : "Claude started",
        body: started?.title ?? "A run is in progress",
      };
    }
    return { aps };
  }

  private createSigner(): ApnsTokenSigner | null {
    const { apns } = this.config;
    if (!apns.enabled || apns.keyFile === null || apns.keyId === null || apns.teamId === null) {
      this.logger.debug("live activity pushes disabled: THEONE_APNS_KEY_FILE, THEONE_APNS_KEY_ID and THEONE_APNS_TEAM_ID are not all set");
      return null;
    }
    try {
      return new ApnsTokenSigner(loadApnsKey(readFileSync(apns.keyFile, "utf8")), apns.keyId, apns.teamId, undefined, this.now);
    } catch (error) {
      this.logger.error("cannot load the APNs key; live activity pushes disabled", { file: apns.keyFile, error });
      return null;
    }
  }
}

function sameContent(a: IslandState, b: IslandState): boolean {
  const strip = ({ updatedAt: _updatedAt, ...rest }: IslandState) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

function reasonOf(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null && typeof (parsed as { reason?: unknown }).reason === "string" ? (parsed as { reason: string }).reason : null;
  } catch {
    return null;
  }
}
