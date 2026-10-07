import { ENV } from "../../shared/runtime";

export const LOG_LIMIT = 200;

const LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LEVELS)[number];

const REDACTIONS: [RegExp, string][] = [
  [/(TS_AUTHKEY=)\S+/g, "$1…"],
  [/(THEONE_TOKEN=)\S+/g, "$1…"],
  [/([?&#]token=)[^&\s]+/g, "$1…"],
  [/tskey-[A-Za-z0-9-]+/g, "…"],
  [/(Bearer\s+)\S+/gi, "$1…"],
];

export function redact(line: string): string {
  return REDACTIONS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), line);
}

export function redactToken(token: string): string {
  return token ? `${token.slice(0, 4)}…` : "";
}

export class LogRing {
  private readonly lines: string[] = [];

  constructor(private readonly limit = LOG_LIMIT) {}

  push(text: string): string[] {
    const added = text
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map(redact);
    this.lines.push(...added);
    if (this.lines.length > this.limit) this.lines.splice(0, this.lines.length - this.limit);
    return added;
  }

  snapshot(): string[] {
    return [...this.lines];
  }

  clear(): void {
    this.lines.length = 0;
  }
}

function threshold(): number {
  const configured = (process.env[ENV.log] ?? "info").toLowerCase();
  const index = LEVELS.indexOf(configured as LogLevel);
  return index === -1 ? 1 : index;
}

export interface Logger {
  debug(message: string, ...rest: unknown[]): void;
  info(message: string, ...rest: unknown[]): void;
  warn(message: string, ...rest: unknown[]): void;
  error(message: string, ...rest: unknown[]): void;
}

export function createLogger(scope: string): Logger {
  const write = (level: LogLevel) => (message: string, ...rest: unknown[]) => {
    if (LEVELS.indexOf(level) < threshold()) return;
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${redact(message)}`;
    (level === "error" || level === "warn" ? console.error : console.log)(line, ...rest);
  };
  return { debug: write("debug"), info: write("info"), warn: write("warn"), error: write("error") };
}

export function setLogLevel(level: LogLevel): void {
  process.env[ENV.log] = level;
}
