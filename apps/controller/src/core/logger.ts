import { LOG_LEVELS } from "@theone/protocol";
import { errorMessage } from "./errors";

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogFields = Record<string, unknown>;

export type Logger = {
  readonly level: LogLevel;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(scope: string): Logger;
};

type Sink = (line: string, level: LogLevel) => void;

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const defaultSink: Sink = (line, level) => {
  if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
};

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function formatValue(value: unknown): string {
  if (value instanceof Error) return JSON.stringify(errorMessage(value));
  if (typeof value === "string") return /^[\w./:@-]*$/.test(value) && value ? value : JSON.stringify(value);
  return stringify(value);
}

function formatFields(fields: LogFields | undefined): string {
  if (!fields) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    parts.push(`${key}=${formatValue(value)}`);
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

export function createLogger(level: LogLevel, scope = "controller", sink: Sink = defaultSink): Logger {
  const write = (target: LogLevel, message: string, fields?: LogFields) => {
    if (RANK[target] < RANK[level]) return;
    const stamp = new Date().toISOString();
    sink(`${stamp} ${target.toUpperCase().padEnd(5)} [${scope}] ${message}${formatFields(fields)}`, target);
  };
  return {
    level,
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
    child: (child) => createLogger(level, `${scope}:${child}`, sink),
  };
}

export const silentLogger: Logger = createLogger("error", "silent", () => {});
