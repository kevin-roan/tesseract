import { accountServiceUrl } from "@/features/account/utils/config";
import { ACCOUNT_ERRORS } from "@/features/account/utils/content";
import { EMPTY_AUTH_DRAFT, appleDisplayName, validateSignIn, validateSignUp } from "@/features/account/utils/form";
import { deviceHostname, randomSuffix, slugLabel } from "@/features/account/utils/hostname";
import { parseStoredSession } from "@/features/account/utils/session";
import { accountLabel, accountRows, deviceRows, needsReconnect, tailnetRows } from "@/features/account/utils/view";

import { runningStatus, sampleDevices, sampleSession } from "./fixtures";

describe("deviceHostname", () => {
  it("slugs the device name into a DNS label with a suffix", () => {
    expect(slugLabel("Vivian’s iPhone XS")).toBe("vivians-iphone-xs");
    expect(slugLabel("Pixel 9 Pro (Work)")).toBe("pixel-9-pro-work");
    expect(slugLabel("Café Phone")).toBe("cafe-phone");
    expect(deviceHostname("Vivian's iPhone XS", "ab12")).toBe("vivians-iphone-xs-ab12");
  });

  it("falls back when the name has nothing usable and caps the length", () => {
    expect(deviceHostname(null, "ab12")).toBe("phone-ab12");
    expect(deviceHostname("😀😀", "ab12")).toBe("phone-ab12");
    const long = deviceHostname("a".repeat(80), "ab12");
    expect(long).toHaveLength(63);
    expect(long.endsWith("-ab12")).toBe(true);
  });

  it("makes a short random base-36 suffix", () => {
    expect(randomSuffix(() => 0)).toBe("0000");
    expect(randomSuffix()).toMatch(/^[a-z0-9]{4}$/);
  });
});

describe("auth form validation", () => {
  it("requires a valid email and a password to sign in", () => {
    expect(validateSignIn(EMPTY_AUTH_DRAFT)).toEqual({
      ok: false,
      errors: { email: ACCOUNT_ERRORS.email, password: ACCOUNT_ERRORS.passwordRequired },
    });
    expect(validateSignIn({ ...EMPTY_AUTH_DRAFT, email: " Dev@Example.com ", password: "x" })).toEqual({
      ok: true,
      value: { email: "dev@example.com", password: "x" },
    });
  });

  it("enforces the password length and an optional name to sign up", () => {
    expect(validateSignUp({ email: "dev@example.com", password: "short", displayName: "" })).toEqual({
      ok: false,
      errors: { password: ACCOUNT_ERRORS.password },
    });
    expect(validateSignUp({ email: "dev@example.com", password: "0123456789", displayName: "" })).toEqual({
      ok: true,
      value: { email: "dev@example.com", password: "0123456789" },
    });
    expect(validateSignUp({ email: "dev@example.com", password: "0123456789", displayName: " Dev " })).toEqual({
      ok: true,
      value: { email: "dev@example.com", password: "0123456789", displayName: "Dev" },
    });
  });

  it("joins the Apple full name when one is given", () => {
    expect(appleDisplayName({ givenName: "Ada", familyName: "Lovelace" })).toBe("Ada Lovelace");
    expect(appleDisplayName({ givenName: null, familyName: null })).toBeUndefined();
    expect(appleDisplayName(null)).toBeUndefined();
  });
});

describe("parseStoredSession", () => {
  it("accepts a valid unexpired session only", () => {
    expect(parseStoredSession(JSON.stringify(sampleSession))).toEqual(sampleSession);
    expect(parseStoredSession(JSON.stringify({ ...sampleSession, expiresAt: "2000-01-01T00:00:00.000Z" }))).toBeNull();
    expect(parseStoredSession("{not json")).toBeNull();
    expect(parseStoredSession(null)).toBeNull();
  });
});

describe("account views", () => {
  it("labels and describes the account", () => {
    expect(accountLabel(sampleSession.account)).toBe("dev@example.com");
    expect(accountLabel({ ...sampleSession.account, email: null, displayName: null, provider: "apple" })).toBe("Sign in with Apple");
    expect(accountRows(sampleSession.account).map((row) => row.id)).toEqual(["email", "name", "provider", "since"]);
  });

  it("summarizes the tailnet status", () => {
    expect(tailnetRows(null)).toEqual([{ id: "status", label: "Status", value: "Not available", tone: "neutral" }]);
    expect(tailnetRows(runningStatus).map((row) => [row.id, row.value])).toEqual([
      ["status", "Connected"],
      ["device", "devs-iphone-ab12.tesseract.internal"],
      ["address", "100.64.0.3"],
      ["peers", "1"],
    ]);
    expect(needsReconnect(runningStatus)).toBe(false);
    expect(needsReconnect({ ...runningStatus, state: "starting" })).toBe(false);
    expect(needsReconnect({ ...runningStatus, state: "error" })).toBe(true);
    expect(needsReconnect(null)).toBe(true);
  });

  it("lists online devices first", () => {
    const now = Date.parse("2026-11-08T00:00:00.000Z");
    expect(deviceRows(sampleDevices, now).map((row) => [row.id, row.detail])).toEqual([
      ["2", "Phone · Online"],
      ["1", "Sandbox · Last seen 2h ago"],
    ]);
  });
});

describe("accountServiceUrl", () => {
  const original = process.env.EXPO_PUBLIC_ACCOUNT_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_ACCOUNT_URL = original;
  });

  it("reads EXPO_PUBLIC_ACCOUNT_URL without a trailing slash", () => {
    process.env.EXPO_PUBLIC_ACCOUNT_URL = "https://accounts.example.com/";
    expect(accountServiceUrl()).toBe("https://accounts.example.com");
    process.env.EXPO_PUBLIC_ACCOUNT_URL = " ";
    expect(accountServiceUrl()).toBeNull();
  });
});
