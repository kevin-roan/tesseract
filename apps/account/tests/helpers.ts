import type { Server } from "bun";
import { createAppleVerifier } from "../src/apple";
import { createApp } from "../src/app";
import { APPLE_ISSUER, loadConfig, type Config } from "../src/config";
import { createHeadscaleClient } from "../src/headscale";
import { Store } from "../src/store";
import { FakeHeadscale } from "./fake-headscale";

export const APPLE_AUDIENCE = "dev.tesseract.app";

/** A local RSA key pair served as a JWKS, signing tokens shaped like Apple identity tokens. */
export class FakeApple {
  readonly kid = "test-kid";
  private keys: CryptoKeyPair | null = null;
  private server: Server<undefined> | null = null;
  jwksRequests = 0;

  get jwksUrl(): string {
    return `http://127.0.0.1:${this.server!.port}/auth/keys`;
  }

  async start(): Promise<this> {
    this.keys = await generateRsaKey();
    const publicJwk = await crypto.subtle.exportKey("jwk", this.keys.publicKey);
    this.server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => {
        this.jwksRequests += 1;
        return Response.json({ keys: [{ ...publicJwk, kid: this.kid, alg: "RS256", use: "sig" }] });
      },
    });
    return this;
  }

  async stop(): Promise<void> {
    await this.server?.stop(true);
  }

  async token(claims: Record<string, unknown> = {}, options: { kid?: string; alg?: string; key?: CryptoKey } = {}): Promise<string> {
    const nowS = Math.floor(Date.now() / 1000);
    return signJwt(
      { alg: options.alg ?? "RS256", kid: options.kid ?? this.kid },
      { iss: APPLE_ISSUER, aud: APPLE_AUDIENCE, iat: nowS, exp: nowS + 600, sub: "001234.apple-user", email: "apple@example.com", email_verified: "true", ...claims },
      options.key ?? this.keys!.privateKey,
    );
  }
}

export async function generateRsaKey(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
}

export async function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, key: CryptoKey): Promise<string> {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode(header)}.${encode(payload)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(signature).toString("base64url")}`;
}

export type Harness = {
  config: Config;
  store: Store;
  headscale: FakeHeadscale;
  apple: FakeApple;
  call(method: string, path: string, options?: { body?: unknown; token?: string; ip?: string }): Promise<Response>;
  signUp(email?: string, password?: string): Promise<{ token: string; accountId: string }>;
  close(): Promise<void>;
};

export async function createHarness(overrides: Partial<Config> = {}): Promise<Harness> {
  const headscale = new FakeHeadscale().start();
  const apple = await new FakeApple().start();
  const config: Config = {
    ...loadConfig({
      ACCOUNT_DATA_DIR: "/tmp/unused",
      ACCOUNT_HEADSCALE_URL: headscale.url,
      ACCOUNT_HEADSCALE_API_KEY: headscale.apiKey,
      ACCOUNT_LOGIN_SERVER: "https://net.tesseract.test/",
      ACCOUNT_APPLE_AUDIENCES: `other.app, ${APPLE_AUDIENCE}`,
      ACCOUNT_TRUST_PROXY: "1",
    }),
    appleJwksUrl: apple.jwksUrl,
    signInLimit: { max: 1000, windowMs: 60_000 },
    signUpLimit: { max: 1000, windowMs: 60_000 },
    ...overrides,
  };
  const store = new Store(":memory:");
  const app = createApp({
    config,
    store,
    headscale: createHeadscaleClient(config.headscaleUrl, config.headscaleApiKey),
    apple: createAppleVerifier({ audiences: config.appleAudiences, jwksUrl: config.appleJwksUrl }),
    dummyPasswordHash: await Bun.password.hash("dummy-password", { algorithm: "argon2id" }),
  });
  let counter = 0;

  const call: Harness["call"] = (method, path, options = {}) => {
    const headers: Record<string, string> = { "x-forwarded-for": options.ip ?? "203.0.113.1" };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) headers["content-type"] = "application/json";
    return Promise.resolve(
      app.request(path, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) }),
    );
  };

  return {
    config,
    store,
    headscale,
    apple,
    call,
    async signUp(email, password = "correct horse battery") {
      counter += 1;
      const response = await call("POST", "/v1/accounts", { body: { email: email ?? `user${counter}@example.com`, password } });
      if (response.status !== 201) throw new Error(`sign-up failed: ${response.status} ${await response.text()}`);
      const session = (await response.json()) as { token: string; account: { id: string } };
      return { token: session.token, accountId: session.account.id };
    },
    async close() {
      store.close();
      await headscale.stop();
      await apple.stop();
    },
  };
}
