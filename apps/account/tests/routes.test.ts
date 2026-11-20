import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  AccountDeviceListSchema,
  AccountErrorSchema,
  AccountSchema,
  AccountSessionSchema,
  DeviceKeySchema,
} from "@tesseract/protocol";
import { hashToken } from "../src/tokens";
import { createHarness, type Harness } from "./helpers";

let h: Harness;

beforeEach(async () => {
  h = await createHarness();
});

afterEach(async () => {
  await h.close();
});

async function errorCode(response: Response): Promise<string> {
  return AccountErrorSchema.parse(await response.json()).error.code;
}

describe("health", () => {
  test("GET /v1/health", async () => {
    const response = await h.call("GET", "/v1/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("unknown route is a 404 AccountError", async () => {
    const response = await h.call("GET", "/v1/nope");
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe("not_found");
  });
});

describe("POST /v1/accounts", () => {
  test("creates an account and returns a session", async () => {
    const response = await h.call("POST", "/v1/accounts", {
      body: { email: "  Alice@Example.com ", password: "correct horse battery", displayName: "Alice" },
    });
    expect(response.status).toBe(201);
    const session = AccountSessionSchema.parse(await response.json());
    expect(session.account).toMatchObject({ email: "alice@example.com", displayName: "Alice", provider: "password" });
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const days = (new Date(session.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  test("stores only the SHA-256 hash of the token and an argon2id password hash", async () => {
    const { token, accountId } = await h.signUp("hash@example.com");
    const sessions = h.store.db.query<{ token_hash: string }, []>("SELECT token_hash FROM sessions").all();
    expect(sessions).toEqual([{ token_hash: hashToken(token) }]);
    expect(h.store.accountById(accountId)?.password_hash).toStartWith("$argon2id$");
  });

  test("409 email_taken", async () => {
    await h.signUp("dup@example.com");
    const response = await h.call("POST", "/v1/accounts", { body: { email: "DUP@example.com", password: "another password" } });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("email_taken");
  });

  test("400 on a short password, a bad email or a non-JSON body", async () => {
    for (const body of [{ email: "a@example.com", password: "short" }, { email: "nope", password: "long enough pass" }]) {
      const response = await h.call("POST", "/v1/accounts", { body });
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe("invalid_request");
    }
    const raw = await h.call("POST", "/v1/accounts", { body: undefined });
    expect(raw.status).toBe(400);
  });

  test("rate limited per IP", async () => {
    await h.close();
    h = await createHarness({ signUpLimit: { max: 2, windowMs: 60_000 } });
    const body = { email: "x@example.com", password: "short" };
    expect((await h.call("POST", "/v1/accounts", { body })).status).toBe(400);
    expect((await h.call("POST", "/v1/accounts", { body })).status).toBe(400);
    const limited = await h.call("POST", "/v1/accounts", { body });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(await errorCode(limited)).toBe("rate_limited");
    expect((await h.call("POST", "/v1/accounts", { body, ip: "198.51.100.7" })).status).toBe(400);
  });
});

describe("POST /v1/sessions", () => {
  test("signs in with the right password", async () => {
    await h.signUp("bob@example.com", "bob password 123");
    const response = await h.call("POST", "/v1/sessions", { body: { email: "Bob@Example.com", password: "bob password 123" } });
    expect(response.status).toBe(200);
    const session = AccountSessionSchema.parse(await response.json());
    expect(session.account.email).toBe("bob@example.com");
  });

  test("401 invalid_credentials for a wrong password or an unknown email", async () => {
    await h.signUp("bob@example.com", "bob password 123");
    for (const body of [
      { email: "bob@example.com", password: "wrong password" },
      { email: "nobody@example.com", password: "bob password 123" },
    ]) {
      const response = await h.call("POST", "/v1/sessions", { body });
      expect(response.status).toBe(401);
      expect(await errorCode(response)).toBe("invalid_credentials");
    }
  });

  test("401 for an Apple account, which has no password", async () => {
    await h.call("POST", "/v1/sessions/apple", { body: { identityToken: await h.apple.token() } });
    const response = await h.call("POST", "/v1/sessions", { body: { email: "apple@example.com", password: "anything at all" } });
    expect(response.status).toBe(401);
  });

  test("rate limited per IP", async () => {
    await h.close();
    h = await createHarness({ signInLimit: { max: 3, windowMs: 60_000 } });
    const body = { email: "nobody@example.com", password: "whatever pass" };
    for (let i = 0; i < 3; i += 1) expect((await h.call("POST", "/v1/sessions", { body })).status).toBe(401);
    expect((await h.call("POST", "/v1/sessions", { body })).status).toBe(429);
  });
});

describe("sessions and /v1/me", () => {
  test("GET /v1/me returns the account", async () => {
    const { token, accountId } = await h.signUp("me@example.com");
    const response = await h.call("GET", "/v1/me", { token });
    expect(response.status).toBe(200);
    expect(AccountSchema.parse(await response.json())).toMatchObject({ id: accountId, email: "me@example.com", provider: "password" });
  });

  test("401 without, or with a bad, bearer token", async () => {
    expect((await h.call("GET", "/v1/me")).status).toBe(401);
    const response = await h.call("GET", "/v1/me", { token: "not-a-token" });
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("unauthorized");
  });

  test("expired sessions are rejected", async () => {
    const { token } = await h.signUp();
    h.store.db.query("UPDATE sessions SET expires_at = ?").run(Date.now() - 1);
    expect((await h.call("GET", "/v1/me", { token })).status).toBe(401);
  });

  test("DELETE /v1/sessions/current signs out only that session", async () => {
    const { token } = await h.signUp("out@example.com", "out password 1");
    const other = AccountSessionSchema.parse(
      await (await h.call("POST", "/v1/sessions", { body: { email: "out@example.com", password: "out password 1" } })).json(),
    );
    const response = await h.call("DELETE", "/v1/sessions/current", { token });
    expect(response.status).toBe(204);
    expect((await h.call("GET", "/v1/me", { token })).status).toBe(401);
    expect((await h.call("GET", "/v1/me", { token: other.token })).status).toBe(200);
    expect((await h.call("DELETE", "/v1/sessions/current")).status).toBe(401);
  });
});

describe("devices", () => {
  test("POST /v1/devices/keys creates the Headscale user lazily and a single-use 1 h key", async () => {
    const { token, accountId } = await h.signUp();
    const response = await h.call("POST", "/v1/devices/keys", { token, body: { kind: "mobile", hostname: "Kevins-iPhone" } });
    expect(response.status).toBe(201);
    const key = DeviceKeySchema.parse(await response.json());
    expect(key).toMatchObject({
      loginServer: "https://net.tesseract.test",
      magicDnsSuffix: "tesseract.internal",
      hostname: "kevins-iphone",
      tags: [],
    });
    const minutes = (new Date(key.expiresAt).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);

    expect(h.headscale.users.map((user) => user.name)).toEqual([`u-${accountId}`]);
    const stored = h.headscale.keys.find((entry) => entry.key === key.authKey)!;
    expect(stored).toMatchObject({ user: h.headscale.users[0]!.id, reusable: false, ephemeral: false });

    await h.call("POST", "/v1/devices/keys", { token, body: { kind: "sandbox", hostname: "sandbox" } });
    expect(h.headscale.users).toHaveLength(1);
    expect(h.headscale.requests.filter((line) => line.startsWith("POST /api/v1/user"))).toHaveLength(1);
  });

  test("reuses an existing Headscale user with the same name", async () => {
    const { token, accountId } = await h.signUp();
    h.headscale.users.push({ id: "77", name: `u-${accountId}`, displayName: "", createdAt: new Date().toISOString() });
    expect((await h.call("POST", "/v1/devices/keys", { token, body: { kind: "desktop", hostname: "mac" } })).status).toBe(201);
    expect(h.headscale.users).toHaveLength(1);
    expect(h.store.accountById(accountId)?.headscale_user_id).toBe("77");
  });

  test("400 for an unknown kind or invalid hostname", async () => {
    const { token } = await h.signUp();
    for (const body of [{ kind: "toaster", hostname: "x" }, { kind: "mobile", hostname: "-bad-" }]) {
      expect((await h.call("POST", "/v1/devices/keys", { token, body })).status).toBe(400);
    }
  });

  test("502 tailnet_unavailable when Headscale fails", async () => {
    const { token } = await h.signUp();
    h.headscale.failNext = true;
    const response = await h.call("POST", "/v1/devices/keys", { token, body: { kind: "mobile", hostname: "phone" } });
    expect(response.status).toBe(502);
    expect(await errorCode(response)).toBe("tailnet_unavailable");
  });

  test("device routes require a session", async () => {
    expect((await h.call("POST", "/v1/devices/keys", { body: { kind: "mobile", hostname: "p" } })).status).toBe(401);
    expect((await h.call("GET", "/v1/devices")).status).toBe(401);
    expect((await h.call("DELETE", "/v1/devices/1")).status).toBe(401);
  });

  test("GET /v1/devices lists only the caller's nodes, with their kind", async () => {
    const alice = await h.signUp("alice@example.com");
    const bob = await h.signUp("bob@example.com");
    expect(AccountDeviceListSchema.parse(await (await h.call("GET", "/v1/devices", { token: alice.token })).json())).toEqual({ devices: [] });

    const phoneKey = DeviceKeySchema.parse(await (await h.call("POST", "/v1/devices/keys", { token: alice.token, body: { kind: "mobile", hostname: "phone" } })).json());
    const boxKey = DeviceKeySchema.parse(await (await h.call("POST", "/v1/devices/keys", { token: alice.token, body: { kind: "sandbox", hostname: "box" } })).json());
    const bobKey = DeviceKeySchema.parse(await (await h.call("POST", "/v1/devices/keys", { token: bob.token, body: { kind: "desktop", hostname: "bob-mac" } })).json());
    const phone = h.headscale.register(phoneKey.authKey, "phone");
    h.headscale.register(boxKey.authKey, "box", false);
    h.headscale.register(bobKey.authKey, "bob-mac");
    expect(() => h.headscale.register(phoneKey.authKey, "again")).toThrow("key already used");

    const list = AccountDeviceListSchema.parse(await (await h.call("GET", "/v1/devices", { token: alice.token })).json());
    expect(list.devices).toEqual([
      { id: phone.id, hostname: "phone", dnsName: "phone.tesseract.internal", ips: phone.ipAddresses, kind: "mobile", online: true, lastSeen: phone.lastSeen },
      expect.objectContaining({ hostname: "box", kind: "sandbox", online: false, lastSeen: null }),
    ]);
    const bobList = AccountDeviceListSchema.parse(await (await h.call("GET", "/v1/devices", { token: bob.token })).json());
    expect(bobList.devices.map((device) => [device.hostname, device.kind])).toEqual([["bob-mac", "desktop"]]);
  });

  test("DELETE /v1/devices/:id removes own nodes and 404s for another user's node", async () => {
    const alice = await h.signUp("alice@example.com");
    const bob = await h.signUp("bob@example.com");
    const aliceKey = DeviceKeySchema.parse(await (await h.call("POST", "/v1/devices/keys", { token: alice.token, body: { kind: "mobile", hostname: "phone" } })).json());
    const bobKey = DeviceKeySchema.parse(await (await h.call("POST", "/v1/devices/keys", { token: bob.token, body: { kind: "mobile", hostname: "phone" } })).json());
    const aliceNode = h.headscale.register(aliceKey.authKey, "phone");
    const bobNode = h.headscale.register(bobKey.authKey, "phone");

    const forbidden = await h.call("DELETE", `/v1/devices/${bobNode.id}`, { token: alice.token });
    expect(forbidden.status).toBe(404);
    expect(await errorCode(forbidden)).toBe("not_found");
    expect(h.headscale.nodes.some((node) => node.id === bobNode.id)).toBe(true);
    expect((await h.call("DELETE", "/v1/devices/9999", { token: alice.token })).status).toBe(404);

    expect((await h.call("DELETE", `/v1/devices/${aliceNode.id}`, { token: alice.token })).status).toBe(204);
    expect(h.headscale.nodes.map((node) => node.id)).toEqual([bobNode.id]);
  });

  test("DELETE /v1/devices/:id 404s for an account with no Headscale user yet", async () => {
    const { token } = await h.signUp();
    expect((await h.call("DELETE", "/v1/devices/1", { token })).status).toBe(404);
  });
});

describe("DELETE /v1/me", () => {
  test("removes nodes, the Headscale user, sessions and the account", async () => {
    const alice = await h.signUp("alice@example.com", "alice password");
    const bob = await h.signUp("bob@example.com");
    const key = DeviceKeySchema.parse(await (await h.call("POST", "/v1/devices/keys", { token: alice.token, body: { kind: "mobile", hostname: "phone" } })).json());
    const bobKey = DeviceKeySchema.parse(await (await h.call("POST", "/v1/devices/keys", { token: bob.token, body: { kind: "mobile", hostname: "phone" } })).json());
    h.headscale.register(key.authKey, "phone");
    const bobNode = h.headscale.register(bobKey.authKey, "phone");

    const response = await h.call("DELETE", "/v1/me", { token: alice.token });
    expect(response.status).toBe(204);
    expect(h.headscale.users.map((user) => user.name)).toEqual([`u-${bob.accountId}`]);
    expect(h.headscale.nodes.map((node) => node.id)).toEqual([bobNode.id]);
    expect(h.store.accountById(alice.accountId)).toBeNull();
    expect(h.store.db.query("SELECT * FROM sessions WHERE account_id = ?").all(alice.accountId)).toEqual([]);
    expect(h.store.db.query("SELECT * FROM device_keys WHERE account_id = ?").all(alice.accountId)).toEqual([]);
    expect((await h.call("GET", "/v1/me", { token: alice.token })).status).toBe(401);
    const signIn = await h.call("POST", "/v1/sessions", { body: { email: "alice@example.com", password: "alice password" } });
    expect(signIn.status).toBe(401);
    expect((await h.call("GET", "/v1/me", { token: bob.token })).status).toBe(200);
  });

  test("works for an account that never created a device", async () => {
    const { token, accountId } = await h.signUp();
    expect((await h.call("DELETE", "/v1/me", { token })).status).toBe(204);
    expect(h.store.accountById(accountId)).toBeNull();
  });

  test("keeps the account when Headscale fails so the user can retry", async () => {
    const { token, accountId } = await h.signUp();
    await h.call("POST", "/v1/devices/keys", { token, body: { kind: "mobile", hostname: "phone" } });
    h.headscale.failNext = true;
    expect((await h.call("DELETE", "/v1/me", { token })).status).toBe(502);
    expect(h.store.accountById(accountId)).not.toBeNull();
    expect((await h.call("DELETE", "/v1/me", { token })).status).toBe(204);
  });
});
