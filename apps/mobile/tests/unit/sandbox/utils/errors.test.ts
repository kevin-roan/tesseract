import {
  AbortError,
  ApiError,
  NetworkError,
  ProtocolError,
  ProtocolVersionError,
  TimeoutError,
} from "@tesseract/client";

import { describeError, isRetryableError, issueForError } from "@/features/sandbox/utils/errors";
import { issueNotice } from "@/features/sandbox/utils/states";

const unauthorized = new ApiError(401, "unauthorized", "Missing or invalid credentials");
const forbidden = new ApiError(403, "forbidden", "Path escapes the workspace");
const versionMismatch = new ProtocolVersionError("/v1/events", 2, 1);

describe("describeError", () => {
  it("asks to pair again when the token is rejected", () => {
    expect(describeError(unauthorized)).toMatch(/Pair it again/);
  });

  it("names both protocol versions on a mismatch", () => {
    expect(describeError(versionMismatch)).toBe(
      "The sandbox speaks protocol v2 and this app speaks v1. Update the app or the sandbox so they match.",
    );
  });

  it("explains offline, timeouts, format drift and server messages", () => {
    expect(describeError(new NetworkError("fetch failed"))).toMatch(/Can't reach the sandbox/);
    expect(describeError(new TimeoutError("/v1/status", 15_000))).toMatch(/too long/);
    expect(describeError(new ProtocolError("/v1/status", "bad"))).toMatch(/unexpected format/);
    expect(describeError(new ApiError(409, "conflict", "Port 3000 is in use"))).toBe("Port 3000 is in use");
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("weird")).toBe("Something went wrong.");
  });
});

describe("issueForError", () => {
  it("turns a revoked token and a version mismatch into sandbox issues", () => {
    expect(issueForError(unauthorized)).toBe("unauthorized");
    expect(issueForError(forbidden)).toBe("unauthorized");
    expect(issueForError(versionMismatch)).toBe("incompatible");
  });

  it("ignores errors that retrying can fix", () => {
    expect(issueForError(new NetworkError("offline"))).toBeNull();
    expect(issueForError(new TimeoutError("/v1/status", 1))).toBeNull();
    expect(issueForError(new ApiError(503, "unavailable", "no display"))).toBeNull();
    expect(issueForError(new ProtocolError("/v1/events", "unknown event type"))).toBeNull();
    expect(issueForError(null)).toBeNull();
  });

  it("has a notice with a re-pair action for every issue", () => {
    expect(issueNotice("unauthorized")).toMatchObject({ actionLabel: "Pair again" });
    expect(issueNotice("incompatible").title).toBe("Version mismatch");
  });
});

describe("isRetryableError", () => {
  it("retries network trouble and server errors only", () => {
    expect(isRetryableError(new NetworkError("offline"))).toBe(true);
    expect(isRetryableError(new TimeoutError("/v1/status", 1))).toBe(true);
    expect(isRetryableError(new ApiError(503, "unavailable", "down"))).toBe(true);
    expect(isRetryableError(new ApiError(429, "bad_request", "slow down"))).toBe(true);
    expect(isRetryableError(unauthorized)).toBe(false);
    expect(isRetryableError(new ApiError(404, "not_found", "gone"))).toBe(false);
    expect(isRetryableError(versionMismatch)).toBe(false);
    expect(isRetryableError(new AbortError("/v1/status"))).toBe(false);
  });
});
