import { createAccountApi } from "@/features/account/api/client";
import { AccountApiError, describeAccountError, isUnauthorized } from "@/features/account/api/errors";
import { ACCOUNT_ERRORS } from "@/features/account/utils/content";

import { jsonResponse, sampleDeviceKey, sampleDevices, sampleSession } from "./fixtures";

const BASE = "https://accounts.example.com";

function setup(...responses: (Response | Error)[]) {
  const fetch = jest.fn();
  for (const response of responses) {
    if (response instanceof Error) fetch.mockRejectedValueOnce(response);
    else fetch.mockResolvedValueOnce(response);
  }
  return { fetch, api: createAccountApi({ baseUrl: BASE, fetch: fetch as unknown as typeof globalThis.fetch }) };
}

function request(fetch: jest.Mock, call = 0) {
  const [url, init] = fetch.mock.calls[call] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe("account api client", () => {
  it("signs in and parses the session", async () => {
    const { fetch, api } = setup(jsonResponse(200, sampleSession));
    await expect(api.signIn({ email: "dev@example.com", password: "secret" })).resolves.toEqual(sampleSession);
    const { url, init, headers } = request(fetch);
    expect(url).toBe(`${BASE}/v1/sessions`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "dev@example.com", password: "secret" });
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBeUndefined();
  });

  it("creates accounts and Apple sessions on their routes", async () => {
    const { fetch, api } = setup(jsonResponse(201, sampleSession), jsonResponse(200, sampleSession));
    await api.signUp({ email: "dev@example.com", password: "0123456789" });
    await api.signInWithApple({ identityToken: "jwt", displayName: "Dev" });
    expect(request(fetch, 0).url).toBe(`${BASE}/v1/accounts`);
    expect(request(fetch, 1).url).toBe(`${BASE}/v1/sessions/apple`);
    expect(JSON.parse(request(fetch, 1).init.body as string)).toEqual({ identityToken: "jwt", displayName: "Dev" });
  });

  it("sends the bearer token and parses device keys and lists", async () => {
    const { fetch, api } = setup(jsonResponse(201, sampleDeviceKey), jsonResponse(200, { devices: sampleDevices }));
    await expect(api.createDeviceKey("tok", { kind: "mobile", hostname: "phone-ab12" })).resolves.toEqual(sampleDeviceKey);
    await expect(api.devices("tok")).resolves.toEqual({ devices: sampleDevices });
    expect(request(fetch, 0).url).toBe(`${BASE}/v1/devices/keys`);
    expect(request(fetch, 0).headers.Authorization).toBe("Bearer tok");
    expect(request(fetch, 1).init.method).toBe("GET");
    expect(request(fetch, 1).init.body).toBeUndefined();
  });

  it("handles 204 responses for deletes", async () => {
    const { fetch, api } = setup(jsonResponse(204), jsonResponse(204), jsonResponse(204));
    await expect(api.signOut("tok")).resolves.toBeUndefined();
    await expect(api.deleteAccount("tok")).resolves.toBeUndefined();
    await expect(api.removeDevice("tok", "node/1")).resolves.toBeUndefined();
    expect(request(fetch, 0)).toMatchObject({ url: `${BASE}/v1/sessions/current`, init: { method: "DELETE" } });
    expect(request(fetch, 1)).toMatchObject({ url: `${BASE}/v1/me`, init: { method: "DELETE" } });
    expect(request(fetch, 2).url).toBe(`${BASE}/v1/devices/node%2F1`);
  });

  it("maps AccountError bodies to AccountApiError", async () => {
    const { api } = setup(jsonResponse(409, { error: { code: "email_taken", message: "Email taken" } }));
    const error = await api.signUp({ email: "dev@example.com", password: "0123456789" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountApiError);
    expect(error).toMatchObject({ status: 409, code: "email_taken" });
    expect(describeAccountError(error)).toBe(ACCOUNT_ERRORS.emailTaken);
  });

  it("falls back to the HTTP status for unknown error bodies", async () => {
    const { api } = setup(jsonResponse(502, { nope: true }));
    await expect(api.me("tok")).rejects.toMatchObject({ status: 502, code: "http_502" });
  });

  it("rejects responses that don't match the schema", async () => {
    const { api } = setup(jsonResponse(200, { token: 1 }));
    await expect(api.signIn({ email: "a@b.co", password: "x" })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("reports network failures and a missing service URL", async () => {
    const { api } = setup(new TypeError("Network request failed"));
    const error = await api.me("tok").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: "network_error" });
    expect(describeAccountError(error)).toBe(ACCOUNT_ERRORS.network);

    const unconfigured = createAccountApi({ baseUrl: null, fetch: jest.fn() as unknown as typeof fetch });
    const missing = await unconfigured.me("tok").catch((e: unknown) => e);
    expect(describeAccountError(missing)).toBe(ACCOUNT_ERRORS.notConfigured);
  });

  it("tells expired sessions apart from wrong passwords", () => {
    expect(isUnauthorized(new AccountApiError(401, "unauthorized", "no"))).toBe(true);
    expect(isUnauthorized(new AccountApiError(401, "invalid_credentials", "no"))).toBe(false);
    expect(describeAccountError(new AccountApiError(401, "invalid_credentials", "no"))).toBe(ACCOUNT_ERRORS.invalidCredentials);
    expect(describeAccountError(new AccountApiError(401, "unauthorized", "no"))).toBe(ACCOUNT_ERRORS.unauthorized);
  });
});
