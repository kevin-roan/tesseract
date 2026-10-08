import { ApiError, NetworkError, ProtocolError, ProtocolVersionError, TimeoutError } from "@tesseract/client";
import { RETRYABLE_API_STATUSES } from "./constants";
import { ERROR_MESSAGES, GATEWAY_MESSAGES, GATEWAY_STATUS_TEXT } from "./labels";
import type { ConnectionStatus } from "./types";

export class NotConfiguredError extends Error {
  constructor() {
    super(ERROR_MESSAGES.notConfiguredInternal);
    this.name = "NotConfiguredError";
  }
}

export function isUnauthorizedError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 401 || error.code === "unauthorized");
}

function apiMessage(error: ApiError): string {
  const gateway = GATEWAY_MESSAGES[error.status];
  const message = error.message.trim();
  const generic = !message || message === GATEWAY_STATUS_TEXT[error.status] || message === ERROR_MESSAGES.httpStatus(error.status);
  return gateway && generic ? gateway : message || ERROR_MESSAGES.httpStatus(error.status);
}

export function describeError(error: unknown): string {
  if (error === null || error === undefined) return "";
  if (isUnauthorizedError(error)) return ERROR_MESSAGES.unauthorized;
  if (error instanceof ApiError) return apiMessage(error);
  if (error instanceof TimeoutError) return ERROR_MESSAGES.timeout;
  if (error instanceof NetworkError) return ERROR_MESSAGES.network;
  if (error instanceof ProtocolVersionError) return ERROR_MESSAGES.protocolVersion(error.serverVersion, error.clientVersion);
  if (error instanceof ProtocolError) return ERROR_MESSAGES.protocol;
  if (error instanceof NotConfiguredError) return ERROR_MESSAGES.notConfigured;
  if (error instanceof Error) return error.message || ERROR_MESSAGES.fallback;
  return String(error) || ERROR_MESSAGES.fallback;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ProtocolError || error instanceof NotConfiguredError) return false;
  if (error instanceof ApiError) return error.status >= 500 || RETRYABLE_API_STATUSES.includes(error.status);
  return true;
}

export function statusForError(error: unknown): ConnectionStatus {
  if (error instanceof ProtocolVersionError) return "incompatible";
  if (isUnauthorizedError(error)) return "unauthorized";
  if (error instanceof NotConfiguredError) return "unconfigured";
  return "offline";
}
