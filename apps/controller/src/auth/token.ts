import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isValidToken } from "@theone/protocol";
import type { Config } from "../config";

export type TokenSource = "env" | "file" | "generated";
export type ResolvedToken = { token: string; source: TokenSource };

const TOKEN_BYTES = 32;
const FILE_MODE = 0o600;

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function readTokenFile(path: string): string | null {
  if (!existsSync(path)) return null;
  const token = readFileSync(path, "utf8").trim();
  if (!token) return null;
  if (!isValidToken(token)) throw new TokenError(`Token file ${path} does not contain a valid token`);
  return token;
}

function writeExclusive(path: string, token: string): boolean {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    writeFileSync(path, `${token}\n`, { mode: FILE_MODE, flag: "wx" });
    chmodSync(path, FILE_MODE);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

/** THEONE_TOKEN wins; otherwise the token file is read, or created (0600) when `create` is set. */
export function resolveToken(config: Config, options: { create: boolean }): ResolvedToken | null {
  if (config.tokenFromEnv) return { token: config.tokenFromEnv, source: "env" };
  const existing = readTokenFile(config.tokenFile);
  if (existing) return { token: existing, source: "file" };
  if (!options.create) return null;
  const token = generateToken();
  if (writeExclusive(config.tokenFile, token)) return { token, source: "generated" };
  const raced = readTokenFile(config.tokenFile);
  if (!raced) throw new TokenError(`Could not read the token file ${config.tokenFile}`);
  return { token: raced, source: "file" };
}

function writeAtomic(path: string, token: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${token}\n`, { mode: FILE_MODE, flag: "w" });
  chmodSync(temp, FILE_MODE);
  renameSync(temp, path);
}

export function rotateToken(config: Config): string {
  const token = generateToken();
  writeAtomic(config.tokenFile, token);
  return token;
}

function fileHolds(path: string, token: string): boolean {
  try {
    return readTokenFile(path) === token;
  } catch {
    return false;
  }
}

/**
 * Children never inherit THEONE_TOKEN, so an env-configured token is also kept in the
 * token file (0600) where in-sandbox CLI calls read it. Returns whether the file changed.
 */
export function mirrorTokenToFile(config: Config, token: string): boolean {
  if (fileHolds(config.tokenFile, token)) return false;
  writeAtomic(config.tokenFile, token);
  return true;
}

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/** Constant-time comparison; hashing first makes both buffers the same length regardless of input. */
export function tokensEqual(candidate: string, expected: string): boolean {
  return timingSafeEqual(digest(candidate), digest(expected));
}
