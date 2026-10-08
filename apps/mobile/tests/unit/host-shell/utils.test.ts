import { ApiError, NetworkError, ProtocolError, ProtocolVersionError } from "@tesseract/client";
import type { HostLockStatus } from "@tesseract/protocol";

import { PIN_KEYS, pinDotCount, pinKeyId, pinKeyLabel } from "@/components/pin-pad/utils/keys";
import { describeHostError, hostIssueFor, isPinMissing, isPinRejected, isSessionLost } from "@/features/host-shell/utils/errors";
import { hostName, parseHostPairingText } from "@/features/host-shell/utils/pairing";
import { EMPTY_PIN, isCompletePin, pinReducer } from "@/features/host-shell/utils/pin";
import { formatCountdown, isSessionLive, lockLine, lockedOutFor, sessionRemainingMs } from "@/features/host-shell/utils/session";

const NOW = Date.parse("2026-10-03T10:00:00.000Z");
const typed = (digits: string) => [...digits].reduce((state, digit) => pinReducer(state, { type: "digit", digit }), EMPTY_PIN);
const status = (overrides: Partial<HostLockStatus> = {}): HostLockStatus => ({ pinSet: true, attemptsLeft: 5, lockedUntil: null, ...overrides });

describe("pinReducer", () => {
  it("appends digits up to 12 and ignores anything else", () => {
    expect(typed("123456").digits).toBe("123456");
    expect(typed("1234567890123").digits).toBe("123456789012");
    expect(pinReducer(EMPTY_PIN, { type: "digit", digit: "a" })).toBe(EMPTY_PIN);
    expect(pinReducer(EMPTY_PIN, { type: "digit", digit: "12" })).toBe(EMPTY_PIN);
  });

  it("deletes, clears and rejects", () => {
    expect(pinReducer(typed("123"), { type: "delete" }).digits).toBe("12");
    expect(pinReducer(EMPTY_PIN, { type: "delete" }).digits).toBe("");
    expect(pinReducer(typed("123"), { type: "clear" })).toEqual(EMPTY_PIN);
    expect(pinReducer(typed("123456"), { type: "reject" })).toEqual({ digits: "", error: true });
  });

  it("clears the error once the user types again", () => {
    const rejected = pinReducer(typed("123456"), { type: "reject" });
    expect(pinReducer(rejected, { type: "digit", digit: "1" })).toEqual({ digits: "1", error: false });
  });

  it("only accepts 6 to 12 digits", () => {
    expect(isCompletePin("12345")).toBe(false);
    expect(isCompletePin("123456")).toBe(true);
    expect(isCompletePin("123456789012")).toBe(true);
    expect(isCompletePin("1234567890123")).toBe(false);
  });
});

describe("pin pad keys", () => {
  it("lays out ten digits, delete and submit with unique ids", () => {
    const keys = PIN_KEYS.flat();
    expect(keys.filter((key) => key.kind === "digit")).toHaveLength(10);
    expect(new Set(keys.map(pinKeyId)).size).toBe(keys.length);
    expect(pinKeyLabel({ kind: "submit" }, "Unlock")).toBe("Unlock");
    expect(pinKeyLabel({ kind: "delete" }, "Unlock")).toBe("Delete");
    expect(pinDotCount(2, 6)).toBe(6);
    expect(pinDotCount(8, 6)).toBe(8);
  });
});

describe("session timing", () => {
  const session = { session: "hss_1", expiresAt: "2026-10-03T10:15:00.000Z" };

  it("counts down to expiry", () => {
    expect(sessionRemainingMs(session, NOW)).toBe(15 * 60_000);
    expect(isSessionLive(session, NOW)).toBe(true);
    expect(isSessionLive(session, NOW + 15 * 60_000)).toBe(false);
    expect(sessionRemainingMs(null, NOW)).toBe(0);
    expect(sessionRemainingMs({ session: "x", expiresAt: "nope" }, NOW)).toBe(0);
  });

  it("formats minutes and seconds", () => {
    expect(formatCountdown(15 * 60_000)).toBe("15:00");
    expect(formatCountdown(61_500)).toBe("1:02");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("describes the lock state", () => {
    expect(lockLine(undefined, NOW)).toBeNull();
    expect(lockLine(status(), NOW)).toBeNull();
    expect(lockLine(status({ pinSet: false }), NOW)?.tone).toBe("warning");
    expect(lockLine(status({ attemptsLeft: 1 }), NOW)?.message).toBe("1 attempt left before the host locks.");
    const locked = status({ attemptsLeft: 0, lockedUntil: "2026-10-03T10:05:00.000Z" });
    expect(lockedOutFor(locked, NOW)).toBe(5 * 60_000);
    expect(lockLine(locked, NOW)).toEqual({ tone: "danger", message: "Too many wrong PINs. Try again in 5:00." });
    expect(lockedOutFor(locked, NOW + 6 * 60_000)).toBe(0);
  });
});

describe("host pairing links", () => {
  it("parses tesseract://host links", () => {
    const parsed = parseHostPairingText("tesseract://host?url=http%3A%2F%2F100.64.0.1%3A7701&token=abc&name=desk");
    expect(parsed).toEqual({ ok: true, draft: { url: "http://100.64.0.1:7701", token: "abc", name: "desk" } });
  });

  it("refuses sandbox pairing links and other schemes", () => {
    const sandbox = parseHostPairingText("tesseract://pair?url=http%3A%2F%2F127.0.0.1%3A7700&token=abc");
    expect(sandbox.ok).toBe(false);
    if (!sandbox.ok) expect(sandbox.message).toContain("tesseract://host");
    expect(parseHostPairingText("https://example.com").ok).toBe(false);
  });

  it("falls back to the host id, then a default name", () => {
    expect(hostName(" desk ", "box")).toBe("desk");
    expect(hostName("", "box")).toBe("box");
    expect(hostName("", "")).toBe("Host");
  });
});

describe("host errors", () => {
  it("separates a lost session, a wrong PIN and a missing PIN", () => {
    const unauthorized = new ApiError(401, "unauthorized", "no");
    const forbidden = new ApiError(403, "forbidden", "Wrong PIN (4 attempts left)");
    const unavailable = new ApiError(503, "unavailable", "No PIN set");
    expect(isSessionLost(unauthorized)).toBe(true);
    expect(isSessionLost(forbidden)).toBe(false);
    expect(isPinRejected(forbidden)).toBe(true);
    expect(isPinMissing(unavailable)).toBe(true);
    expect(hostIssueFor(unauthorized)).toBe("unauthorized");
    expect(hostIssueFor(forbidden)).toBeNull();
    expect(describeHostError(forbidden)).toBe("Wrong PIN (4 attempts left)");
    expect(describeHostError(unauthorized)).toContain("Pair again");
  });

  it("explains transport and protocol problems", () => {
    expect(describeHostError(new NetworkError("down"))).toContain("Tailscale");
    expect(describeHostError(new ProtocolError("/v1/health", "bad"))).toContain("not a host shell");
    const version = new ProtocolVersionError("/v1/health", 2, 1);
    expect(describeHostError(version)).toContain("protocol v2");
    expect(hostIssueFor(version)).toBe("incompatible");
  });
});
