import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import {
  ACCOUNT_ROUTES,
  AppleSignInSchema,
  CreateAccountSchema,
  CreateDeviceKeySchema,
  PasswordSignInSchema,
  TESSERACT_NET_TAG_PREFIX,
  type AccountDevice,
  type AccountDeviceKind,
  type AccountDeviceList,
  type AccountError,
  type AccountSession,
  type DeviceKey,
} from "@tesseract/protocol";
import { AppleTokenError, type AppleVerifier } from "./apple";
import type { Config } from "./config";
import { HeadscaleError, type HeadscaleClient, type HeadscaleNode } from "./headscale";
import { RateLimiter } from "./rate-limit";
import { toAccount, type AccountRow, type Store } from "./store";
import { hashToken, newSessionToken, SESSION_TTL_MS } from "./tokens";

export const DEVICE_KEY_TTL_MS = 60 * 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;

export type Services = {
  config: Config;
  store: Store;
  headscale: HeadscaleClient;
  apple: AppleVerifier;
  /** A password hash verified when the email is unknown, so sign-in takes the same time either way. */
  dummyPasswordHash: string;
  now?: () => number;
};

type Env = { Variables: { account: AccountRow; tokenHash: string } };

class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

function errorBody(code: string, message: string): AccountError {
  return { error: { code, message } };
}

export function headscaleUserName(accountId: string): string {
  return `u-${accountId}`;
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, "invalid_request", "Request body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    throw new HttpError(400, "invalid_request", path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid body"));
  }
  return parsed.data;
}

function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (forwarded) return forwarded;
  }
  const server = c.env as { requestIP?: (request: Request) => { address: string } | null } | undefined;
  return server?.requestIP?.(c.req.raw)?.address ?? "unknown";
}

function deviceKind(node: HeadscaleNode, kinds: Map<string, AccountDeviceKind>): AccountDeviceKind | null {
  const recorded = node.preAuthKeyId ? kinds.get(node.preAuthKeyId) : undefined;
  if (recorded) return recorded;
  const tag = node.tags.find((entry) => entry.startsWith(TESSERACT_NET_TAG_PREFIX));
  const fromTag = tag?.slice(TESSERACT_NET_TAG_PREFIX.length);
  return fromTag === "mobile" || fromTag === "desktop" || fromTag === "sandbox" || fromTag === "server" ? fromTag : null;
}

export function createApp(services: Services): Hono<Env> {
  const { config, store, headscale, apple } = services;
  const now = services.now ?? Date.now;
  const signInLimiter = new RateLimiter(config.signInLimit, now);
  const signUpLimiter = new RateLimiter(config.signUpLimit, now);
  const app = new Hono<Env>();

  function limit(c: Context, limiter: RateLimiter): void {
    const wait = limiter.hit(clientIp(c, config.trustProxy));
    if (wait > 0) {
      throw new HttpError(429, "rate_limited", "Too many attempts, try again later", { "Retry-After": String(wait) });
    }
  }

  function issueSession(account: AccountRow): AccountSession {
    const token = newSessionToken();
    const expiresAt = now() + SESSION_TTL_MS;
    store.createSession(hashToken(token), account.id, expiresAt);
    return { token, expiresAt: new Date(expiresAt).toISOString(), account: toAccount(account) };
  }

  async function ensureHeadscaleUser(account: AccountRow): Promise<string> {
    if (account.headscale_user_id) return account.headscale_user_id;
    const name = headscaleUserName(account.id);
    const user = (await headscale.findUser(name)) ?? (await headscale.createUser(name, account.display_name));
    store.setHeadscaleUserId(account.id, user.id);
    account.headscale_user_id = user.id;
    return user.id;
  }

  async function accountNodes(account: AccountRow): Promise<HeadscaleNode[]> {
    if (!account.headscale_user_id) return [];
    const nodes = await headscale.listNodes(headscaleUserName(account.id));
    return nodes.filter((node) => node.userId === null || node.userId === account.headscale_user_id);
  }

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      for (const [name, value] of Object.entries(error.headers)) c.header(name, value);
      return c.json(errorBody(error.code, error.message), error.status);
    }
    if (error instanceof HeadscaleError) {
      console.error(error.message);
      return c.json(errorBody("tailnet_unavailable", "The Tesseract Network control server is unavailable"), 502);
    }
    console.error(error);
    return c.json(errorBody("internal", "Internal server error"), 500);
  });
  app.notFound((c) => c.json(errorBody("not_found", "Not found"), 404));

  app.use(
    "/v1/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
  );
  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json(errorBody("invalid_request", "Request body is too large"), 413),
    }),
  );

  const requireSession = async (c: Context<Env>, next: () => Promise<void>) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const tokenHash = token ? hashToken(token) : "";
    const account = tokenHash ? store.sessionAccount(tokenHash, now()) : null;
    if (!account) throw new HttpError(401, "unauthorized", "Sign in to continue");
    c.set("account", account);
    c.set("tokenHash", tokenHash);
    await next();
  };

  app.get(ACCOUNT_ROUTES.health, (c) => c.json({ ok: true as const }));

  app.post(ACCOUNT_ROUTES.accounts, async (c) => {
    limit(c, signUpLimiter);
    const body = await parseBody(c, CreateAccountSchema);
    if (store.accountByEmail(body.email)) throw new HttpError(409, "email_taken", "An account with this email already exists");
    const passwordHash = await hashPassword(body.password);
    let account: AccountRow;
    try {
      account = store.createAccount({
        email: body.email,
        displayName: body.displayName ?? null,
        provider: "password",
        passwordHash,
        appleSub: null,
      });
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new HttpError(409, "email_taken", "An account with this email already exists");
      throw error;
    }
    return c.json(issueSession(account), 201);
  });

  app.post(ACCOUNT_ROUTES.sessions, async (c) => {
    limit(c, signInLimiter);
    const body = await parseBody(c, PasswordSignInSchema);
    const account = store.accountByEmail(body.email);
    const hash = account?.password_hash ?? services.dummyPasswordHash;
    const valid = await Bun.password.verify(body.password, hash);
    if (!account?.password_hash || !valid) throw new HttpError(401, "invalid_credentials", "Email or password is incorrect");
    return c.json(issueSession(account));
  });

  app.post(ACCOUNT_ROUTES.appleSessions, async (c) => {
    limit(c, signInLimiter);
    const body = await parseBody(c, AppleSignInSchema);
    let identity;
    try {
      identity = await apple.verify(body.identityToken);
    } catch (error) {
      if (error instanceof AppleTokenError) throw new HttpError(401, "invalid_apple_token", error.message);
      throw error;
    }
    let account = store.accountByAppleSub(identity.sub);
    if (!account) {
      const email = identity.email && !store.accountByEmail(identity.email) ? identity.email : null;
      account = store.createAccount({
        email,
        displayName: body.displayName ?? null,
        provider: "apple",
        passwordHash: null,
        appleSub: identity.sub,
      });
    }
    return c.json(issueSession(account));
  });

  app.delete(ACCOUNT_ROUTES.currentSession, requireSession, (c) => {
    store.deleteSession(c.get("tokenHash"));
    return c.body(null, 204);
  });

  app.get(ACCOUNT_ROUTES.me, requireSession, (c) => c.json(toAccount(c.get("account"))));

  app.delete(ACCOUNT_ROUTES.me, requireSession, async (c) => {
    const account = c.get("account");
    const name = headscaleUserName(account.id);
    const user = await headscale.findUser(name);
    if (user) {
      for (const node of await headscale.listNodes(name)) await headscale.deleteNode(node.id);
      await headscale.deleteUser(user.id);
    }
    store.deleteAccount(account.id);
    return c.body(null, 204);
  });

  app.post(ACCOUNT_ROUTES.deviceKeys, requireSession, async (c) => {
    const account = c.get("account");
    const body = await parseBody(c, CreateDeviceKeySchema);
    const userId = await ensureHeadscaleUser(account);
    const key = await headscale.createPreAuthKey({
      userId,
      expiration: new Date(now() + DEVICE_KEY_TTL_MS),
      aclTags: [],
    });
    store.recordDeviceKey(key.id, account.id, body.kind, body.hostname);
    const result: DeviceKey = {
      authKey: key.key,
      loginServer: config.loginServer,
      magicDnsSuffix: config.netDomain,
      hostname: body.hostname,
      tags: key.aclTags,
      expiresAt: key.expiration ?? new Date(now() + DEVICE_KEY_TTL_MS).toISOString(),
    };
    return c.json(result, 201);
  });

  app.get(ACCOUNT_ROUTES.devices, requireSession, async (c) => {
    const account = c.get("account");
    const kinds = store.deviceKinds(account.id);
    const devices: AccountDevice[] = (await accountNodes(account)).map((node) => {
      const hostname = node.givenName || node.name;
      return {
        id: node.id,
        hostname,
        dnsName: node.givenName ? `${node.givenName}.${config.netDomain}` : null,
        ips: node.ipAddresses,
        kind: deviceKind(node, kinds),
        online: node.online,
        lastSeen: node.lastSeen,
      };
    });
    const result: AccountDeviceList = { devices };
    return c.json(result);
  });

  app.delete(`${ACCOUNT_ROUTES.devices}/:id`, requireSession, async (c) => {
    const account = c.get("account");
    const id = c.req.param("id");
    const node = (await accountNodes(account)).find((entry) => entry.id === id);
    if (!node) throw new HttpError(404, "not_found", "Device not found");
    await headscale.deleteNode(node.id);
    return c.body(null, 204);
  });

  return app;
}
