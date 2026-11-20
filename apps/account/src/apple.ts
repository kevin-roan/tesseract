import { APPLE_ISSUER } from "./config";

export type AppleIdentity = { sub: string; email: string | null; emailVerified: boolean };

export interface AppleVerifier {
  verify(identityToken: string): Promise<AppleIdentity>;
}

export class AppleTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleTokenError";
  }
}

type Jwk = { kty?: string; n?: string; e?: string; kid?: string; alg?: string };

type AppleClaims = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
};

const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_MIN_REFRESH_MS = 60 * 1000;
const CLOCK_SKEW_S = 60;

function decodeSegment<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    throw new AppleTokenError("Identity token is malformed");
  }
}

export type AppleVerifierOptions = {
  audiences: string[];
  jwksUrl: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export function createAppleVerifier(options: AppleVerifierOptions): AppleVerifier {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  let keys = new Map<string, CryptoKey>();
  let fetchedAt = 0;

  async function refresh(): Promise<void> {
    let response: Response;
    try {
      response = await fetchImpl(options.jwksUrl, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new Error(`Apple JWKS unreachable: ${(error as Error).message}`);
    }
    if (!response.ok) throw new Error(`Apple JWKS request failed (${response.status})`);
    const body = (await response.json()) as { keys?: Jwk[] };
    const next = new Map<string, CryptoKey>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid || jwk.kty !== "RSA" || (jwk.alg && jwk.alg !== "RS256")) continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: jwk.kty, n: jwk.n, e: jwk.e },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      next.set(jwk.kid, key);
    }
    keys = next;
    fetchedAt = now();
  }

  async function keyFor(kid: string): Promise<CryptoKey> {
    const stale = now() - fetchedAt > JWKS_TTL_MS;
    if (stale || (!keys.has(kid) && now() - fetchedAt > JWKS_MIN_REFRESH_MS)) await refresh();
    const key = keys.get(kid);
    if (!key) throw new AppleTokenError("Identity token is signed by an unknown key");
    return key;
  }

  return {
    async verify(identityToken) {
      if (options.audiences.length === 0) throw new AppleTokenError("Sign in with Apple is not configured");
      const parts = identityToken.split(".");
      if (parts.length !== 3) throw new AppleTokenError("Identity token is malformed");
      const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
      const header = decodeSegment<{ alg?: unknown; kid?: unknown }>(headerPart);
      if (header.alg !== "RS256" || typeof header.kid !== "string") {
        throw new AppleTokenError("Identity token must be RS256 with a key id");
      }
      const key = await keyFor(header.kid);
      const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        Buffer.from(signaturePart, "base64url"),
        new TextEncoder().encode(`${headerPart}.${payloadPart}`),
      );
      if (!valid) throw new AppleTokenError("Identity token signature is invalid");

      const claims = decodeSegment<AppleClaims>(payloadPart);
      if (claims.iss !== APPLE_ISSUER) throw new AppleTokenError("Identity token issuer is not Apple");
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!audiences.some((aud) => typeof aud === "string" && options.audiences.includes(aud))) {
        throw new AppleTokenError("Identity token audience is not accepted");
      }
      const nowS = Math.floor(now() / 1000);
      if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_S < nowS) {
        throw new AppleTokenError("Identity token has expired");
      }
      if (typeof claims.iat === "number" && claims.iat - CLOCK_SKEW_S > nowS) {
        throw new AppleTokenError("Identity token is issued in the future");
      }
      if (typeof claims.sub !== "string" || !claims.sub) throw new AppleTokenError("Identity token has no subject");
      const emailVerified = claims.email_verified === true || claims.email_verified === "true";
      const email = typeof claims.email === "string" && emailVerified ? claims.email.trim().toLowerCase() : null;
      return { sub: claims.sub, email, emailVerified };
    },
  };
}
