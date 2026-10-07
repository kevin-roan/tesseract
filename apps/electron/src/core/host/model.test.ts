import { ApiError, NetworkError, TimeoutError } from "@theone/client";
import { describe, expect, it } from "vitest";
import { INITIAL_HOST_SHELL_STATE } from "./constants";
import {
  appendLog,
  cliError,
  describeHostError,
  healthUrl,
  hostToken,
  isAuthError,
  isHostHealth,
  isOwned,
  isReady,
  isServing,
  isSessionRequired,
  parsePairing,
  pinError,
  sessionExpiry,
  sessionLive,
  sessionRequiredError,
  splitCommand,
  viewerError,
} from "./model";

const PAIRING = { link: "theone://host?url=http%3A%2F%2F127.0.0.1%3A7799&token=abc%2Fdef&name=box", url: "http://127.0.0.1:7799", name: "box" };

describe("cliError", () => {
  it("prefers the last error: line and strips the prefix", () => {
    expect(cliError("info\nERROR: first\nsomething\nerror:   second\ntrailing", 2)).toBe("second");
  });

  it("falls back to the last line, then to the exit code", () => {
    expect(cliError("  one\n two  \n\n", 1)).toBe("two");
    expect(cliError("\n  \n", 3)).toBe("The controller exited with code 3");
    expect(cliError("", null)).toBe("The controller failed");
  });
});

describe("parsePairing", () => {
  it("parses the last JSON line", () => {
    const stdout = `noise\n{"link":"old","url":"x"}\n${JSON.stringify({ ...PAIRING, pinSet: true })}\nwarning: tail`;
    expect(parsePairing(stdout)).toEqual({ ...PAIRING, pinSet: true });
  });

  it("defaults name and pinSet", () => {
    expect(parsePairing(JSON.stringify({ link: "l", url: "u", pinSet: "yes" }))).toEqual({ link: "l", url: "u", name: "", pinSet: false });
  });

  it("rejects output without a pairing link", () => {
    expect(() => parsePairing("nothing here")).toThrow("The controller printed no pairing link");
    expect(() => parsePairing('{"url":"u"}')).toThrow("The controller printed no pairing link");
    expect(() => parsePairing("{broken")).toThrow("The controller printed no pairing link");
  });
});

describe("hostToken", () => {
  it("reads and decodes the token from the query", () => {
    expect(hostToken(PAIRING.link)).toBe("abc/def");
    expect(hostToken("theone://host?token=a#token=b")).toBe("a");
    expect(hostToken("theone://host?token=first&token=second")).toBe("first");
  });

  it("fails without a token", () => {
    expect(() => hostToken("theone://host?url=x#token=b")).toThrow("The host pairing link has no token");
    expect(() => hostToken("theone://host?token=")).toThrow("The host pairing link has no token");
  });
});

describe("pinError", () => {
  it("validates length and digits, then the repeat", () => {
    expect(pinError("12345", "12345")).toBe("pin");
    expect(pinError("1234567890123", "1234567890123")).toBe("pin");
    expect(pinError("12345a", "12345a")).toBe("pin");
    expect(pinError("123456", "123457")).toBe("repeat");
    expect(pinError("123456", "123456")).toBeNull();
    expect(pinError("123456789012", "123456789012")).toBeNull();
  });
});

describe("state helpers", () => {
  const state = (status: typeof INITIAL_HOST_SHELL_STATE.status, pinSet = true) => ({
    ...INITIAL_HOST_SHELL_STATE,
    status,
    pairing: { ...PAIRING, pinSet },
  });

  it("derives serving, owned and ready", () => {
    expect(isServing(state("running"))).toBe(true);
    expect(isServing(state("external"))).toBe(true);
    expect(isServing(state("starting"))).toBe(false);
    expect(isOwned(state("stopping"))).toBe(true);
    expect(isOwned(state("external"))).toBe(false);
    expect(isReady(state("running"))).toBe(true);
    expect(isReady(state("running", false))).toBe(false);
    expect(isReady({ ...state("running"), pairing: null })).toBe(false);
  });
});

describe("health", () => {
  it("builds the URL and recognises the host daemon", () => {
    expect(healthUrl("https://host.ts.net:8443/")).toBe("https://host.ts.net:8443/v1/health");
    expect(isHostHealth({ ok: true, service: "host-shell", version: "1" })).toBe(true);
    expect(isHostHealth({ ok: true, service: "controller" })).toBe(false);
    expect(isHostHealth({ ok: "true", service: "host-shell" })).toBe(false);
    expect(isHostHealth(null)).toBe(false);
  });
});

describe("appendLog", () => {
  it("keeps the last lines", () => {
    expect(appendLog(["a", "b"], ["c", "d"], 3)).toEqual(["b", "c", "d"]);
    expect(appendLog([], ["x"])).toEqual(["x"]);
  });
});

describe("sessions", () => {
  it("expires a session 30 s early", () => {
    const expiresAt = sessionExpiry("2026-01-01T00:15:00.000Z");
    expect(sessionLive(expiresAt, expiresAt - 31_000)).toBe(true);
    expect(sessionLive(expiresAt, expiresAt - 30_000)).toBe(false);
    expect(sessionExpiry("not a date")).toBe(0);
  });

  it("marks session errors", () => {
    expect(isSessionRequired(sessionRequiredError())).toBe(true);
    expect(isSessionRequired(new Error("x"))).toBe(false);
  });
});

describe("describeHostError", () => {
  it("uses the server message, or says the host is not answering", () => {
    expect(describeHostError(new ApiError(403, "forbidden", "Wrong PIN; 4 attempts left"), "http://h")).toBe("Wrong PIN; 4 attempts left");
    expect(describeHostError(new NetworkError("ECONNREFUSED"), "http://h")).toBe("The host shell is not answering at http://h");
    expect(describeHostError(new TimeoutError("/v1/android", 10), "http://h")).toBe("The host shell is not answering at http://h");
    expect(describeHostError(new Error("boom"), "http://h")).toBe("boom");
    expect(isAuthError(new ApiError(401, "unauthorized", "no"))).toBe(true);
    expect(isAuthError(new ApiError(500, "internal", "no"))).toBe(false);
  });
});

describe("splitCommand", () => {
  it("splits like a POSIX shell", () => {
    expect(splitCommand("bun run  /a/b.ts")).toEqual(["bun", "run", "/a/b.ts"]);
    expect(splitCommand(`'/opt/My App/bin' "--flag=a b" c\\ d ""`)).toEqual(["/opt/My App/bin", "--flag=a b", "c d", ""]);
    expect(splitCommand(`"say \\"hi\\""`)).toEqual(['say "hi"']);
    expect(() => splitCommand("'open")).toThrow();
  });
});

describe("viewerError", () => {
  const fallback = (code: number | null) => `scrcpy exited with code ${code}`;
  it("prefers the last ERROR: line", () => {
    expect(viewerError(["INFO: x", "ERROR: Could not find device", "ERROR: Server connection failed", "bye"], 1, fallback)).toBe(
      "Server connection failed",
    );
    expect(viewerError(["just text"], 1, fallback)).toBe("just text");
    expect(viewerError([], 2, fallback)).toBe("scrcpy exited with code 2");
  });
});
