import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AccountErrorSchema, AccountSessionSchema } from "@tesseract/protocol";
import { AppleTokenError, createAppleVerifier } from "../src/apple";
import { createHarness, generateRsaKey, type Harness } from "./helpers";

let h: Harness;

beforeEach(async () => {
  h = await createHarness();
});

afterEach(async () => {
  await h.close();
});

async function appleSignIn(identityToken: string, displayName?: string) {
  return h.call("POST", "/v1/sessions/apple", { body: { identityToken, ...(displayName ? { displayName } : {}) } });
}

describe("POST /v1/sessions/apple", () => {
  test("creates the account on first use and signs in to it afterwards", async () => {
    const first = await appleSignIn(await h.apple.token(), "Apple Person");
    expect(first.status).toBe(200);
    const session = AccountSessionSchema.parse(await first.json());
    expect(session.account).toMatchObject({ provider: "apple", email: "apple@example.com", displayName: "Apple Person" });

    const second = AccountSessionSchema.parse(await (await appleSignIn(await h.apple.token({ email: undefined }))).json());
    expect(second.account.id).toBe(session.account.id);
    expect(second.token).not.toBe(session.token);
    expect((await h.call("GET", "/v1/me", { token: second.token })).status).toBe(200);
  });

  test("does not take over an email already used by a password account", async () => {
    const existing = await h.signUp("apple@example.com");
    const session = AccountSessionSchema.parse(await (await appleSignIn(await h.apple.token())).json());
    expect(session.account.id).not.toBe(existing.accountId);
    expect(session.account.email).toBeNull();
  });

  test("ignores an unverified email", async () => {
    const session = AccountSessionSchema.parse(await (await appleSignIn(await h.apple.token({ email_verified: "false" }))).json());
    expect(session.account.email).toBeNull();
  });

  const rejected: Array<[string, () => Promise<string>]> = [
    ["wrong issuer", () => h.apple.token({ iss: "https://evil.example.com" })],
    ["wrong audience", () => h.apple.token({ aud: "someone.else" })],
    ["expired", () => h.apple.token({ exp: Math.floor(Date.now() / 1000) - 3600 })],
    ["issued in the future", () => h.apple.token({ iat: Math.floor(Date.now() / 1000) + 3600 })],
    ["no subject", () => h.apple.token({ sub: "" })],
    ["unknown key id", () => h.apple.token({}, { kid: "other" })],
    ["HS256 header", () => h.apple.token({}, { alg: "HS256" })],
    ["signed by another key", async () => h.apple.token({}, { key: (await generateRsaKey()).privateKey })],
    ["tampered payload", async () => {
      const [header, , signature] = (await h.apple.token()).split(".");
      const payload = Buffer.from(JSON.stringify({ iss: "https://appleid.apple.com", aud: "dev.tesseract.app", sub: "attacker", exp: 9_999_999_999 })).toString("base64url");
      return `${header}.${payload}.${signature}`;
    }],
    ["malformed", async () => "not.a.jwt"],
  ];

  for (const [name, make] of rejected) {
    test(`401 invalid_apple_token: ${name}`, async () => {
      const response = await appleSignIn(await make());
      expect(response.status).toBe(401);
      expect(AccountErrorSchema.parse(await response.json()).error.code).toBe("invalid_apple_token");
    });
  }

  test("caches the JWKS", async () => {
    await appleSignIn(await h.apple.token({ sub: "a" }));
    await appleSignIn(await h.apple.token({ sub: "b" }));
    expect(h.apple.jwksRequests).toBe(1);
  });
});

describe("createAppleVerifier", () => {
  test("accepts an audience array and rejects when no audiences are configured", async () => {
    const verifier = createAppleVerifier({ audiences: ["dev.tesseract.app"], jwksUrl: h.apple.jwksUrl });
    const identity = await verifier.verify(await h.apple.token({ aud: ["x", "dev.tesseract.app"], email_verified: true }));
    expect(identity).toEqual({ sub: "001234.apple-user", email: "apple@example.com", emailVerified: true });

    const unconfigured = createAppleVerifier({ audiences: [], jwksUrl: h.apple.jwksUrl });
    await expect(unconfigured.verify(await h.apple.token())).rejects.toBeInstanceOf(AppleTokenError);
  });

  test("refetches the JWKS for an unknown key id at most once a minute", async () => {
    let clock = Date.now();
    const verifier = createAppleVerifier({ audiences: ["dev.tesseract.app"], jwksUrl: h.apple.jwksUrl, now: () => clock });
    await verifier.verify(await h.apple.token());
    const bad = await h.apple.token({}, { kid: "rotated" });
    await expect(verifier.verify(bad)).rejects.toThrow("unknown key");
    expect(h.apple.jwksRequests).toBe(1);
    clock += 61_000;
    await expect(verifier.verify(bad)).rejects.toThrow("unknown key");
    expect(h.apple.jwksRequests).toBe(2);
  });
});
