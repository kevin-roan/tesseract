import { ApiError, NetworkError, ProtocolError, ProtocolVersionError, TimeoutError, isApiError } from "@theone/client";

import type { HostIssue } from "../types";

export function describeHostError(error: unknown): string {
  if (isApiError(error, "unauthorized")) return "The host rejected this device. Pair again with `bun run host pair`.";
  if (error instanceof ApiError) return error.message;
  if (error instanceof TimeoutError) return "The host took too long to answer.";
  if (error instanceof NetworkError) return "Can't reach the host. Check that Tailscale is connected and `bun run host serve` is running.";
  if (error instanceof ProtocolVersionError) {
    return `The host speaks protocol v${String(error.serverVersion)} and this app speaks v${error.clientVersion}. Update the app or the host so they match.`;
  }
  if (error instanceof ProtocolError) return "That address is not a host shell. Check the URL printed by `bun run host pair`.";
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

export function isSessionLost(error: unknown): boolean {
  return isApiError(error, "unauthorized");
}

export function isPinRejected(error: unknown): boolean {
  return isApiError(error, "forbidden");
}

export function isPinMissing(error: unknown): boolean {
  return isApiError(error, "unavailable");
}

export function hostIssueFor(error: unknown): HostIssue | null {
  if (isApiError(error, "unauthorized")) return "unauthorized";
  if (error instanceof ProtocolVersionError) return "incompatible";
  return null;
}
