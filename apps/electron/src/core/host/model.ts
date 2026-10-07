import { ApiError, NetworkError, TimeoutError } from "@theone/client";
import type { HostPairing, HostShellState } from "../../shared/contracts/hostShell";
import { IpcError, type IpcErrorCode } from "../../shared/ipc-types";
import { ERROR_PREFIX, HEALTH_PATH, HOST_SERVICE_NAME, HOST_SHELL, SESSION_REQUIRED, VIEWER } from "./constants";
import { HOST_LABELS } from "./labels";

export class HostShellError extends IpcError {
  constructor(message: string, code: IpcErrorCode = "unavailable", detail?: string) {
    super(code, message, detail);
    this.name = "HostShellError";
  }
}

export function sessionRequiredError(message: string = HOST_LABELS.locked): HostShellError {
  return new HostShellError(message, "forbidden", SESSION_REQUIRED);
}

export function isSessionRequired(error: unknown): boolean {
  return error instanceof IpcError && error.code === "forbidden" && error.detail === SESSION_REQUIRED;
}

export function isServing(state: HostShellState): boolean {
  return state.status === "running" || state.status === "external";
}

export function isOwned(state: HostShellState): boolean {
  return state.status === "starting" || state.status === "running" || state.status === "stopping";
}

export function isReady(state: HostShellState): boolean {
  return isServing(state) && state.pairing !== null && state.pairing.pinSet;
}

function nonEmptyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function cliError(output: string, code: number | null): string {
  const lines = nonEmptyLines(output);
  const flagged = lines.filter((line) => ERROR_PREFIX.test(line));
  const picked = (flagged.at(-1) ?? lines.at(-1) ?? "").replace(ERROR_PREFIX, "");
  if (picked) return picked;
  return code === null ? HOST_LABELS.failed : HOST_LABELS.exitedWithCode(code);
}

export function parsePairing(stdout: string): HostPairing {
  const line = stdout
    .split(/\r?\n/)
    .reverse()
    .find((candidate) => candidate.trim().startsWith("{"));
  let data: unknown;
  try {
    data = JSON.parse(line ?? "");
  } catch {
    throw new HostShellError(HOST_LABELS.noPairing, "internal");
  }
  if (typeof data !== "object" || data === null) throw new HostShellError(HOST_LABELS.noPairing, "internal");
  const record = data as Record<string, unknown>;
  if (typeof record.link !== "string" || typeof record.url !== "string") {
    throw new HostShellError(HOST_LABELS.noPairing, "internal");
  }
  return {
    link: record.link,
    url: record.url,
    name: typeof record.name === "string" ? record.name : "",
    pinSet: record.pinSet === true,
  };
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function linkParams(link: string): Record<string, string> {
  const query = link.split("#")[0]?.split("?").slice(1).join("?") ?? "";
  const result: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const index = pair.indexOf("=");
    const key = decode(index === -1 ? pair : pair.slice(0, index));
    const value = decode(index === -1 ? "" : pair.slice(index + 1));
    if (key === null || value === null || key in result) continue;
    result[key] = value;
  }
  return result;
}

export function hostToken(link: string): string {
  const token = linkParams(link).token;
  if (!token) throw new HostShellError(HOST_LABELS.noToken, "internal");
  return token;
}

export function isValidPin(pin: string): boolean {
  return HOST_SHELL.pinPattern.test(pin);
}

export function pinError(pin: string, repeat: string): "pin" | "repeat" | null {
  if (!isValidPin(pin)) return "pin";
  if (pin !== repeat) return "repeat";
  return null;
}

export function healthUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${HEALTH_PATH}`;
}

export function isHostHealth(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const record = body as Record<string, unknown>;
  return record.ok === true && record.service === HOST_SERVICE_NAME;
}

export function appendLog(log: readonly string[], lines: readonly string[], limit: number = HOST_SHELL.logLimit): string[] {
  const next = [...log, ...lines];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function sessionExpiry(expiresAt: string): number {
  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sessionLive(expiresAt: number, now: number, margin: number = HOST_SHELL.sessionMarginMs): boolean {
  return expiresAt - margin > now;
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function describeHostError(error: unknown, url: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof NetworkError || error instanceof TimeoutError) return HOST_LABELS.notAnswering(url);
  if (error instanceof Error) return error.message;
  return String(error);
}

export function splitCommand(value: string): string[] {
  const words: string[] = [];
  let current = "";
  let started = false;
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] as string;
    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
      continue;
    }
    if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === "\\" && index + 1 < value.length && /["\\$`\n]/.test(value[index + 1] as string)) {
        index += 1;
        current += value[index];
      } else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === "\\" && index + 1 < value.length) {
      index += 1;
      current += value[index];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) words.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (quote) throw new HostShellError(`Unbalanced quote in "${value}"`, "invalid_argument");
  if (started) words.push(current);
  return words;
}

export function viewerError(stderr: readonly string[], code: number | null, fallback: (code: number | null) => string): string {
  const lines = stderr.map((line) => line.trim()).filter(Boolean);
  const flagged = lines.filter((line) => VIEWER.errorPrefix.test(line)).at(-1);
  if (flagged) return flagged.replace(VIEWER.errorPrefix, "");
  return lines.at(-1) ?? fallback(code);
}
