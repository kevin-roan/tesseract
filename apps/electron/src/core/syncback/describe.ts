import { ApiError, NetworkError, ProtocolError, ProtocolVersionError, TimeoutError } from "@tesseract/client";
import { ERROR_DESCRIPTIONS } from "./labels";

const UNAUTHORIZED_STATUS = 401;
const UNAUTHORIZED_CODE = "unauthorized";

export class NotConfiguredError extends Error {
  constructor() {
    super(ERROR_DESCRIPTIONS.notConfigured);
    this.name = "NotConfiguredError";
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === UNAUTHORIZED_STATUS || error.code === UNAUTHORIZED_CODE);
}

export function describeError(error: unknown): string {
  if (error === null || error === undefined) return "";
  if (isAuthError(error)) return ERROR_DESCRIPTIONS.auth;
  if (error instanceof ApiError) return error.message;
  if (error instanceof TimeoutError) return ERROR_DESCRIPTIONS.timeout;
  if (error instanceof NetworkError) return ERROR_DESCRIPTIONS.network;
  if (error instanceof ProtocolVersionError) return ERROR_DESCRIPTIONS.version(error.serverVersion, error.clientVersion);
  if (error instanceof ProtocolError) return ERROR_DESCRIPTIONS.protocol;
  if (error instanceof NotConfiguredError) return ERROR_DESCRIPTIONS.notConfigured;
  return (error instanceof Error ? error.message : String(error)) || ERROR_DESCRIPTIONS.fallback;
}
