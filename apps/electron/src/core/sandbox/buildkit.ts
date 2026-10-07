import {
  BUILD_STAGES,
  FAILURE_VERTEX_LOG_TAIL,
  HEAVY_STEP,
  HEAVY_WEIGHT,
  PLAIN_DONE,
  PLAIN_ERROR,
  PLAIN_LINE,
  PLAIN_OUTPUT,
  STEP_NAME,
} from "./constants";
import { SANDBOX_LABELS } from "./labels";

export type BuildWeights = Record<string, number[]>;

export interface BuildSnapshot {
  fraction: number | null;
  step: string;
  cachedSteps: number;
  doneSteps: number;
  totalSteps: number | null;
  bytes?: { current: number; total: number };
}

interface StepInfo {
  stage: string;
  index: number;
  count: number;
  cmd: string;
}

interface VertexState {
  key: string;
  index: number;
  name: string;
  step: StepInfo | null;
  startedSeq: number | null;
  completed: boolean;
  cached: boolean;
  error: string | null;
  logs: string[];
  partial: string;
  bytes: { current: number; total: number } | null;
}

interface RawVertex {
  digest: string;
  name?: string;
  started?: string;
  completed?: string;
  cached?: boolean;
  error?: string;
}

interface RawStatus {
  vertex: string;
  total?: number;
  current?: number;
}

interface RawLog {
  vertex: string;
  data: string;
}

interface SolveStatus {
  vertexes?: RawVertex[];
  statuses?: RawStatus[];
  logs?: RawLog[];
}

export function parseStepName(name: string): StepInfo | null {
  const match = STEP_NAME.exec(name);
  if (!match?.groups) return null;
  return {
    stage: match.groups.stage as string,
    index: Number(match.groups.index),
    count: Number(match.groups.count),
    cmd: match.groups.cmd as string,
  };
}

export function stepWeight(cmd: string): number {
  return /^RUN\b/i.test(cmd) && HEAVY_STEP.test(cmd) ? HEAVY_WEIGHT : 1;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export class BuildProgress {
  private readonly vertexes = new Map<string, VertexState>();
  private sequence = 0;
  private best = 0;

  constructor(private readonly weights: BuildWeights | null = null) {}

  private vertex(key: string, name: string | undefined): VertexState {
    let state = this.vertexes.get(key);
    if (!state) {
      state = {
        key,
        index: this.vertexes.size + 1,
        name: name ?? "",
        step: name ? parseStepName(name) : null,
        startedSeq: null,
        completed: false,
        cached: false,
        error: null,
        logs: [],
        partial: "",
        bytes: null,
      };
      this.vertexes.set(key, state);
    } else if (name && !state.name) {
      state.name = name;
      state.step = parseStepName(name);
    }
    return state;
  }

  private remember(state: VertexState, lines: string[]): string[] {
    state.logs.push(...lines);
    if (state.logs.length > FAILURE_VERTEX_LOG_TAIL) state.logs.splice(0, state.logs.length - FAILURE_VERTEX_LOG_TAIL);
    return lines.map((line) => `#${state.index} ${line}`);
  }

  pushRaw(line: string): string[] {
    const trimmed = line.trim();
    if (!trimmed) return [];
    let message: SolveStatus;
    try {
      message = JSON.parse(trimmed) as SolveStatus;
    } catch {
      return [line];
    }
    if (typeof message !== "object" || message === null) return [line];
    const out: string[] = [];
    for (const raw of message.vertexes ?? []) {
      const state = this.vertex(raw.digest, raw.name);
      if (raw.started && state.startedSeq === null) {
        state.startedSeq = ++this.sequence;
        out.push(`#${state.index} ${state.name}`);
      }
      if (raw.cached && !state.cached) {
        state.cached = true;
        out.push(`#${state.index} CACHED`);
      }
      if (raw.error && !state.error) {
        state.error = raw.error;
        out.push(`#${state.index} ERROR: ${raw.error}`);
      }
      if (raw.completed && !raw.error && !state.completed) out.push(`#${state.index} DONE`);
      if (raw.completed) state.completed = true;
    }
    for (const status of message.statuses ?? []) {
      const state = this.vertexes.get(status.vertex);
      if (state && typeof status.total === "number" && status.total > 0) {
        state.bytes = { current: status.current ?? 0, total: status.total };
      }
    }
    for (const log of message.logs ?? []) {
      const state = this.vertex(log.vertex, undefined);
      const text = state.partial + Buffer.from(log.data, "base64").toString("utf8");
      const lines = text.split(/\r?\n|\r/);
      state.partial = lines.pop() ?? "";
      out.push(...this.remember(state, lines.filter((entry) => entry.length > 0)));
    }
    return out;
  }

  pushPlain(line: string): string[] {
    const match = PLAIN_LINE.exec(line.trim());
    if (!match?.groups) return line.trim() ? [line] : [];
    const key = `plain:${match.groups.id}`;
    const rest = match.groups.rest as string;
    const existing = this.vertexes.get(key);
    if (!existing) {
      const state = this.vertex(key, rest);
      state.startedSeq = ++this.sequence;
      return [line];
    }
    if (rest === "CACHED") {
      existing.cached = true;
      existing.completed = true;
    } else if (PLAIN_DONE.test(rest)) {
      existing.completed = true;
    } else {
      const error = PLAIN_ERROR.exec(rest);
      if (error?.groups) {
        existing.error = error.groups.message as string;
        existing.completed = true;
      } else {
        const output = PLAIN_OUTPUT.exec(rest);
        this.remember(existing, [output?.groups ? (output.groups.text as string) : rest]);
      }
    }
    return [line];
  }

  private stageTotals(steps: VertexState[]): { weight: number; count: number } {
    const byStage = new Map<string, VertexState[]>();
    for (const state of steps) {
      const stage = (state.step as StepInfo).stage;
      byStage.set(stage, [...(byStage.get(stage) ?? []), state]);
    }
    let weight = 0;
    let count = 0;
    for (const [stage, states] of byStage) {
      const declared = Math.max(...states.map((state) => (state.step as StepInfo).count));
      const fileWeights = this.weights?.[stage];
      const average = fileWeights?.length ? sum(fileWeights) / fileWeights.length : 1;
      const known = new Map(states.map((state) => [(state.step as StepInfo).index, stepWeight((state.step as StepInfo).cmd)]));
      weight += sum([...known.values()]) + Math.max(0, declared - known.size) * average;
      count += Math.max(declared, known.size);
    }
    for (const stage of BUILD_STAGES) {
      if (byStage.has(stage)) continue;
      const fileWeights = this.weights?.[stage];
      if (!fileWeights?.length) continue;
      weight += sum(fileWeights);
      count += fileWeights.length;
    }
    return { weight, count };
  }

  snapshot(): BuildSnapshot {
    const steps = [...this.vertexes.values()].filter((state) => state.step);
    const cachedSteps = steps.filter((state) => state.cached).length;
    const finished = steps.filter((state) => state.cached || (state.completed && !state.error));
    const running = steps
      .filter((state) => state.startedSeq !== null && !state.completed)
      .sort((a, b) => (b.startedSeq ?? 0) - (a.startedSeq ?? 0))[0];
    const latest = running ?? [...steps].sort((a, b) => (b.startedSeq ?? 0) - (a.startedSeq ?? 0))[0];
    if (steps.length === 0) {
      return { fraction: null, step: "", cachedSteps: 0, doneSteps: 0, totalSteps: null };
    }
    const totals = this.stageTotals(steps);
    const done = sum(finished.map((state) => stepWeight((state.step as StepInfo).cmd)));
    const fraction = totals.weight > 0 ? Math.min(1, done / totals.weight) : 0;
    this.best = Math.max(this.best, fraction);
    const snapshot: BuildSnapshot = {
      fraction: this.best,
      step: latest?.step?.cmd ?? "",
      cachedSteps,
      doneSteps: finished.length,
      totalSteps: Math.max(totals.count, steps.length),
    };
    if (running?.bytes) snapshot.bytes = { ...running.bytes };
    return snapshot;
  }

  failure(): { message: string; logs: string[] } | null {
    const failed = [...this.vertexes.values()].filter((state) => state.error).sort((a, b) => a.index - b.index)[0];
    if (!failed) return null;
    return {
      message: SANDBOX_LABELS.build.stepFailed(failed.name, failed.error as string),
      logs: failed.logs.slice(-FAILURE_VERTEX_LOG_TAIL).map((line) => `#${failed.index} ${line}`),
    };
  }

  allCached(): boolean {
    const steps = [...this.vertexes.values()].filter((state) => state.step && !/^FROM\b/i.test((state.step as StepInfo).cmd));
    return steps.length > 0 && steps.every((state) => state.cached);
  }
}
