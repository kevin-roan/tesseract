import { join, resolve } from "node:path";
import { ACCOUNT_DEFAULT_PORT, TESSERACT_NET_DEFAULT_DOMAIN } from "@tesseract/protocol";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

export type RateLimit = { max: number; windowMs: number };

export type Config = {
  host: string;
  port: number;
  dataDir: string;
  dbPath: string;
  headscaleUrl: string;
  headscaleApiKey: string;
  loginServer: string;
  netDomain: string;
  appleAudiences: string[];
  appleJwksUrl: string;
  demoEmail: string | null;
  demoPassword: string | null;
  trustProxy: boolean;
  signInLimit: RateLimit;
  signUpLimit: RateLimit;
};

type Env = Record<string, string | undefined>;

function value(env: Env, name: string): string | null {
  const raw = env[name]?.trim();
  return raw ? raw : null;
}

function required(env: Env, name: string): string {
  const raw = value(env, name);
  if (!raw) throw new Error(`${name} is required`);
  return raw;
}

function port(raw: string | null): number {
  if (!raw) return ACCOUNT_DEFAULT_PORT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) throw new Error(`ACCOUNT_PORT is not a port: ${raw}`);
  return parsed;
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function loadConfig(env: Env = process.env): Config {
  const dataDir = resolve(value(env, "ACCOUNT_DATA_DIR") ?? "./data");
  return {
    host: value(env, "ACCOUNT_HOST") ?? "0.0.0.0",
    port: port(value(env, "ACCOUNT_PORT")),
    dataDir,
    dbPath: join(dataDir, "account.sqlite"),
    headscaleUrl: stripSlash(required(env, "ACCOUNT_HEADSCALE_URL")),
    headscaleApiKey: required(env, "ACCOUNT_HEADSCALE_API_KEY"),
    loginServer: stripSlash(required(env, "ACCOUNT_LOGIN_SERVER")),
    netDomain: value(env, "ACCOUNT_NET_DOMAIN") ?? TESSERACT_NET_DEFAULT_DOMAIN,
    appleAudiences: (value(env, "ACCOUNT_APPLE_AUDIENCES") ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    appleJwksUrl: value(env, "ACCOUNT_APPLE_JWKS_URL") ?? APPLE_JWKS_URL,
    demoEmail: value(env, "ACCOUNT_DEMO_EMAIL"),
    demoPassword: value(env, "ACCOUNT_DEMO_PASSWORD"),
    trustProxy: value(env, "ACCOUNT_TRUST_PROXY") === "1",
    signInLimit: { max: 10, windowMs: 60_000 },
    signUpLimit: { max: 5, windowMs: 60_000 },
  };
}
