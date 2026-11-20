import {
  ACCOUNT_ROUTES,
  AccountDeviceListSchema,
  AccountErrorSchema,
  AccountSchema,
  AccountSessionSchema,
  DeviceKeySchema,
  type Account,
  type AccountDeviceList,
  type AccountSession,
  type AppleSignIn,
  type CreateAccount,
  type CreateDeviceKey,
  type DeviceKey,
  type PasswordSignIn,
} from "@tesseract/protocol";

import { accountServiceUrl } from "../utils/config";
import { AccountApiError, INVALID_RESPONSE_CODE, NETWORK_ERROR_CODE, NOT_CONFIGURED_CODE } from "./errors";

const REQUEST_TIMEOUT_MS = 15_000;
const NO_CONTENT = 204;

type Method = "GET" | "POST" | "DELETE";

type Schema<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { message: string } };
};

type RequestOptions = { method: Method; path: string; token?: string; body?: unknown };

export type AccountApiOptions = {
  baseUrl?: string | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

async function errorFrom(response: Response): Promise<AccountApiError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = AccountErrorSchema.safeParse(body);
  return parsed.success
    ? new AccountApiError(response.status, parsed.data.error.code, parsed.data.error.message)
    : new AccountApiError(response.status, `http_${response.status}`, response.statusText);
}

export function createAccountApi({ baseUrl = accountServiceUrl(), fetch: fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS }: AccountApiOptions = {}) {
  async function send({ method, path, token, body }: RequestOptions): Promise<Response> {
    if (!baseUrl) throw new AccountApiError(0, NOT_CONFIGURED_CODE, "Account service URL is not configured");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new AccountApiError(0, NETWORK_ERROR_CODE, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw await errorFrom(response);
    return response;
  }

  async function json<T>(options: RequestOptions, schema: Schema<T>): Promise<T> {
    const response = await send(options);
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new AccountApiError(response.status, INVALID_RESPONSE_CODE, parsed.error.message);
    return parsed.data;
  }

  async function empty(options: RequestOptions): Promise<void> {
    const response = await send(options);
    if (response.status !== NO_CONTENT) await response.text().catch(() => undefined);
  }

  return {
    signUp: (body: CreateAccount): Promise<AccountSession> =>
      json({ method: "POST", path: ACCOUNT_ROUTES.accounts, body }, AccountSessionSchema),
    signIn: (body: PasswordSignIn): Promise<AccountSession> =>
      json({ method: "POST", path: ACCOUNT_ROUTES.sessions, body }, AccountSessionSchema),
    signInWithApple: (body: AppleSignIn): Promise<AccountSession> =>
      json({ method: "POST", path: ACCOUNT_ROUTES.appleSessions, body }, AccountSessionSchema),
    signOut: (token: string): Promise<void> => empty({ method: "DELETE", path: ACCOUNT_ROUTES.currentSession, token }),
    me: (token: string): Promise<Account> => json({ method: "GET", path: ACCOUNT_ROUTES.me, token }, AccountSchema),
    deleteAccount: (token: string): Promise<void> => empty({ method: "DELETE", path: ACCOUNT_ROUTES.me, token }),
    createDeviceKey: (token: string, body: CreateDeviceKey): Promise<DeviceKey> =>
      json({ method: "POST", path: ACCOUNT_ROUTES.deviceKeys, token, body }, DeviceKeySchema),
    devices: (token: string): Promise<AccountDeviceList> =>
      json({ method: "GET", path: ACCOUNT_ROUTES.devices, token }, AccountDeviceListSchema),
    removeDevice: (token: string, id: string): Promise<void> =>
      empty({ method: "DELETE", path: `${ACCOUNT_ROUTES.devices}/${encodeURIComponent(id)}`, token }),
  };
}

export type AccountApi = ReturnType<typeof createAccountApi>;

let shared: AccountApi | null = null;

export function accountApi(): AccountApi {
  shared ??= createAccountApi();
  return shared;
}
