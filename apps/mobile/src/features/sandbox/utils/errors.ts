import {
  AbortError,
  ApiError,
  NetworkError,
  ProtocolError,
  ProtocolVersionError,
  TimeoutError,
  isAuthError,
} from "@tesseract/client";

import type { SandboxIssue } from "../types";

export function describeError(error: unknown): string {
  if (isAuthError(error)) return "The sandbox rejected this token. Pair it again with a fresh link.";
  if (error instanceof ApiError) return error.message;
  if (error instanceof TimeoutError) return "The sandbox took too long to answer.";
  if (error instanceof NetworkError) return "Can't reach the sandbox. Check that Tailscale is connected on this device.";
  if (error instanceof ProtocolVersionError) {
    return `The sandbox speaks protocol v${String(error.serverVersion)} and this app speaks v${error.clientVersion}. Update the app or the sandbox so they match.`;
  }
  if (error instanceof ProtocolError) {
    return "The controller answered in an unexpected format. Update the app or the sandbox so their versions match.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AbortError || error instanceof ProtocolError) return false;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 408 || error.status === 429;
  return true;
}

/** Problems that retrying cannot fix: the token was revoked or the controller speaks another protocol version. */
export function issueForError(error: unknown): SandboxIssue | null {
  if (isAuthError(error)) return "unauthorized";
  if (error instanceof ProtocolVersionError) return "incompatible";
  return null;
}
