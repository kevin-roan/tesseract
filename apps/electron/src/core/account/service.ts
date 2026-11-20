import type { AccountDevice, AccountDeviceKind, DeviceKey } from "@tesseract/protocol";
import type { AccountState } from "../../shared/contracts/account";
import { IpcError } from "../../shared/ipc-types";
import { AccountApiError, AccountClient, normalizeServerUrl, type AccountFetch } from "./client";
import { ACCOUNT_ERROR_CODES } from "./constants";
import { ACCOUNT_LABELS } from "./labels";
import type { AccountStore, StoredAccount, StoredSession } from "./store";

export interface AccountServiceDeps {
  store: AccountStore;
  /** `TESSERACT_ACCOUNT_URL`, used while no server URL is saved. */
  envUrl?: string | null;
  fetch?: AccountFetch;
  now?(): number;
  onChange?(state: AccountState): void;
}

export const SIGNED_OUT: AccountState = { serverUrl: null, account: null, expiresAt: null, persisted: true, error: null };

function toIpcError(error: unknown): IpcError {
  if (error instanceof IpcError) return error;
  if (error instanceof AccountApiError) {
    if (error.code === ACCOUNT_ERROR_CODES.unreachable) return new IpcError("unavailable", error.message);
    if (error.status === 401) return new IpcError("forbidden", error.message);
    if (error.status === 404) return new IpcError("not_found", error.message);
    if (error.status === 400 || error.status === 409 || error.status === 422) return new IpcError("invalid_argument", error.message);
    return new IpcError("unavailable", error.message);
  }
  return new IpcError("internal", error instanceof Error ? error.message : String(error));
}

/** The desktop's Tesseract account (ADR 0014 §6): password sign-in, devices, device keys and deletion. */
export class AccountService {
  private loaded: StoredAccount | null = null;
  private current: AccountState = SIGNED_OUT;

  constructor(private readonly deps: AccountServiceDeps) {}

  state(): AccountState {
    return this.current;
  }

  signedIn(): boolean {
    return this.current.account !== null;
  }

  async load(): Promise<AccountState> {
    const stored = await this.deps.store.read();
    const session = stored.session && this.live(stored.session) ? stored.session : null;
    this.loaded = { ...stored, session };
    this.publish(null);
    return this.current;
  }

  async setServer(raw: string): Promise<AccountState> {
    const stored = await this.stored();
    const serverUrl = raw.trim() ? normalizeServerUrl(raw) : null;
    if (raw.trim() && !serverUrl) throw new IpcError("invalid_argument", ACCOUNT_LABELS.badServer(raw.trim()));
    if (serverUrl === stored.serverUrl) return this.current;
    // Another server means another account: the old session is meaningless there.
    await this.save({ serverUrl, session: null });
    return this.current;
  }

  async signIn(email: string, password: string): Promise<AccountState> {
    const session = await this.run((client) => client.signIn({ email, password }));
    await this.save({ ...(await this.stored()), session });
    return this.current;
  }

  async signUp(email: string, password: string, displayName?: string): Promise<AccountState> {
    const session = await this.run((client) =>
      client.signUp({ email, password, ...(displayName?.trim() ? { displayName: displayName.trim() } : {}) }),
    );
    await this.save({ ...(await this.stored()), session });
    return this.current;
  }

  async signOut(): Promise<AccountState> {
    const stored = await this.stored();
    if (stored.session) await this.client(stored.session.token).signOut().catch(() => undefined);
    await this.save({ ...stored, session: null });
    return this.current;
  }

  /** Re-reads `GET /v1/me`; a rejected session signs out locally. */
  async refresh(): Promise<AccountState> {
    const stored = await this.stored();
    if (!stored.session) return this.current;
    try {
      const account = await this.authed((client) => client.me());
      await this.save({ ...stored, session: { ...stored.session, account } });
    } catch (error) {
      if (error instanceof IpcError && error.code === "forbidden") return this.current;
      this.publish(error instanceof Error ? error.message : String(error));
    }
    return this.current;
  }

  devices(): Promise<AccountDevice[]> {
    return this.authed((client) => client.devices());
  }

  async removeDevice(id: string): Promise<AccountDevice[]> {
    await this.authed((client) => client.removeDevice(id));
    return this.devices();
  }

  async deleteAccount(): Promise<AccountState> {
    await this.authed((client) => client.deleteAccount());
    await this.save({ ...(await this.stored()), session: null });
    return this.current;
  }

  /** A single-use, pre-approved key for a new Tesseract Network node (`POST /v1/devices/keys`). */
  deviceKey(kind: AccountDeviceKind, hostname: string): Promise<DeviceKey> {
    return this.authed((client) => client.createDeviceKey({ kind, hostname }));
  }

  private live(session: StoredSession): boolean {
    const expires = Date.parse(session.expiresAt);
    return !Number.isFinite(expires) || expires > (this.deps.now?.() ?? Date.now());
  }

  private async stored(): Promise<StoredAccount> {
    this.loaded ??= await this.deps.store.read();
    return this.loaded;
  }

  private serverUrl(stored: StoredAccount): string {
    const url = stored.serverUrl ?? (this.deps.envUrl ? normalizeServerUrl(this.deps.envUrl) : null);
    if (!url) throw new IpcError("invalid_argument", ACCOUNT_LABELS.noServer);
    return url;
  }

  private client(token: string | null): AccountClient {
    const stored = this.loaded ?? { serverUrl: null, session: null };
    return new AccountClient({ baseUrl: this.serverUrl(stored), token, fetch: this.deps.fetch });
  }

  private async run<T>(call: (client: AccountClient) => Promise<T>): Promise<T> {
    await this.stored();
    try {
      return await call(this.client(null));
    } catch (error) {
      throw toIpcError(error);
    }
  }

  private async authed<T>(call: (client: AccountClient) => Promise<T>): Promise<T> {
    const stored = await this.stored();
    const session = stored.session;
    if (!session || !this.live(session)) {
      if (session) await this.save({ ...stored, session: null }, ACCOUNT_LABELS.sessionExpired);
      throw new IpcError("forbidden", ACCOUNT_LABELS.signedOut);
    }
    try {
      return await call(this.client(session.token));
    } catch (error) {
      if (error instanceof AccountApiError && error.unauthorized) {
        await this.save({ ...stored, session: null }, ACCOUNT_LABELS.sessionExpired);
        throw new IpcError("forbidden", ACCOUNT_LABELS.sessionExpired);
      }
      throw toIpcError(error);
    }
  }

  private async save(next: StoredAccount, error: string | null = null): Promise<void> {
    this.loaded = next;
    await this.deps.store.write(next);
    this.publish(error);
  }

  private publish(error: string | null): void {
    const stored = this.loaded ?? { serverUrl: null, session: null };
    const envUrl = this.deps.envUrl ? normalizeServerUrl(this.deps.envUrl) : null;
    this.current = {
      serverUrl: stored.serverUrl ?? envUrl,
      account: stored.session?.account ?? null,
      expiresAt: stored.session?.expiresAt ?? null,
      persisted: this.deps.store.canPersist(),
      error,
    };
    this.deps.onChange?.(this.current);
  }
}
