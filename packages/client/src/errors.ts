import type { ErrorCode } from "@theone/protocol";

export class TheOneError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TheOneError";
  }
}

/** The controller answered with a non-2xx status (and usually an ErrorBody). */
export class ApiError extends TheOneError {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** A payload did not match the @theone/protocol schema (server/client version drift or a bug). */
export class ProtocolError extends TheOneError {
  readonly path: string;
  readonly issues: string;

  constructor(path: string, issues: string, options?: { cause?: unknown }) {
    super(`Unexpected payload from ${path}: ${issues}`, options);
    this.name = "ProtocolError";
    this.path = path;
    this.issues = issues;
  }
}

/** The controller speaks another protocol version than this client (from GET /v1/health or the events `hello`). */
export class ProtocolVersionError extends ProtocolError {
  readonly serverVersion: unknown;
  readonly clientVersion: number;

  constructor(path: string, serverVersion: unknown, clientVersion: number) {
    super(path, `protocol version ${String(serverVersion)} is not supported (this client speaks ${clientVersion})`);
    this.name = "ProtocolVersionError";
    this.serverVersion = serverVersion;
    this.clientVersion = clientVersion;
  }
}

export class TimeoutError extends TheOneError {
  readonly timeoutMs: number;

  constructor(path: string, timeoutMs: number) {
    super(`Request to ${path} timed out after ${timeoutMs} ms`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** The request never produced an HTTP response (DNS, TLS, offline, tailnet unreachable, socket error). */
export class NetworkError extends TheOneError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NetworkError";
  }
}

/** The caller aborted the request through its own AbortSignal. `name` matches the DOM convention. */
export class AbortError extends TheOneError {
  constructor(path: string) {
    super(`Request to ${path} was aborted`);
    this.name = "AbortError";
  }
}

export function isApiError(error: unknown, code?: ErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

export function isProtocolVersionError(error: unknown): error is ProtocolVersionError {
  return error instanceof ProtocolVersionError;
}

export function isAuthError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.code === "unauthorized" || error.code === "forbidden");
}
