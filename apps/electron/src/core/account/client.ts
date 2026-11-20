import {
  ACCOUNT_ROUTES,
  AccountDeviceListSchema,
  AccountErrorSchema,
  AccountSchema,
  AccountSessionSchema,
  DeviceKeySchema,
  type Account,
  type AccountDevice,
  type AccountSession,
  type CreateAccount,
  type CreateDeviceKey,
  type DeviceKey,
  type PasswordSignIn,
} from "@tesseract/protocol";
import type { z } from "zod";
import { ACCOUNT, ACCOUNT_ERROR_CODES } from "./constants";
import { ACCOUNT_LABELS } from "./labels";

export type AccountFetch = (input: string, init: RequestInit) => Promise<Response>;

/** An error answer of the account service (`AccountError`), or a transport/parse failure. */
export class AccountApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AccountApiError";
  }

  get unauthorized(): boolean {
    return this.status === 401;
  }
}

export function normalizeServerUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

export interface AccountClientOptions {
  baseUrl: string;
  token?: string | null;
  fetch?: AccountFetch;
  timeoutMs?: number;
}

/** HTTP client of the account service (ADR 0014 §2); every response is parsed with the protocol schemas. */
export class AccountClient {
  private readonly fetchImpl: AccountFetch;

  constructor(private readonly options: AccountClientOptions) {
    this.fetchImpl = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  signUp(body: CreateAccount): Promise<AccountSession> {
    return this.call("POST", ACCOUNT_ROUTES.accounts, AccountSessionSchema, body);
  }

  signIn(body: PasswordSignIn): Promise<AccountSession> {
    return this.call("POST", ACCOUNT_ROUTES.sessions, AccountSessionSchema, body);
  }

  async signOut(): Promise<void> {
    await this.call("DELETE", ACCOUNT_ROUTES.currentSession, null);
  }

  me(): Promise<Account> {
    return this.call("GET", ACCOUNT_ROUTES.me, AccountSchema);
  }

  async deleteAccount(): Promise<void> {
    await this.call("DELETE", ACCOUNT_ROUTES.me, null);
  }

  createDeviceKey(body: CreateDeviceKey): Promise<DeviceKey> {
    return this.call("POST", ACCOUNT_ROUTES.deviceKeys, DeviceKeySchema, body);
  }

  async devices(): Promise<AccountDevice[]> {
    return (await this.call("GET", ACCOUNT_ROUTES.devices, AccountDeviceListSchema)).devices;
  }

  async removeDevice(id: string): Promise<void> {
    await this.call("DELETE", `${ACCOUNT_ROUTES.devices}/${encodeURIComponent(id)}`, null);
  }

  private async call<S extends z.ZodType>(method: string, path: string, schema: S, body?: unknown): Promise<z.infer<S>>;
  private async call(method: string, path: string, schema: null, body?: unknown): Promise<null>;
  private async call(method: string, path: string, schema: z.ZodType | null, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.options.token) headers.Authorization = `Bearer ${this.options.token}`;
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? ACCOUNT.timeoutMs),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new AccountApiError(0, ACCOUNT_ERROR_CODES.unreachable, ACCOUNT_LABELS.unreachable(this.options.baseUrl, detail));
    }
    const text = await response.text().catch(() => "");
    if (!response.ok) throw errorFrom(response.status, text);
    if (!schema) return null;
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new AccountApiError(response.status, ACCOUNT_ERROR_CODES.invalidResponse, ACCOUNT_LABELS.invalidResponse(path));
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new AccountApiError(response.status, ACCOUNT_ERROR_CODES.invalidResponse, ACCOUNT_LABELS.invalidResponse(path));
    return parsed.data;
  }
}

function errorFrom(status: number, text: string): AccountApiError {
  try {
    const parsed = AccountErrorSchema.safeParse(JSON.parse(text));
    if (parsed.success) return new AccountApiError(status, parsed.data.error.code, parsed.data.error.message);
  } catch {
    // not JSON
  }
  const code = status === 401 ? ACCOUNT_ERROR_CODES.unauthorized : `http_${status}`;
  return new AccountApiError(status, code, ACCOUNT_LABELS.httpError(status));
}
