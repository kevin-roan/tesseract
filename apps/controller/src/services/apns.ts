import { createPrivateKey, createSign, type KeyObject } from "node:crypto";
import { connect, constants, type ClientHttp2Session } from "node:http2";

export const APNS_HOSTS = { production: "api.push.apple.com", sandbox: "api.sandbox.push.apple.com" } as const;

export type ApnsRequest = {
  host: string;
  path: string;
  headers: Record<string, string>;
  body: string;
};

export type ApnsResponse = { status: number; body: string };

/** One HTTP/2 POST to APNs; the real one keeps a session per host, tests use a fake. */
export interface ApnsTransport {
  send(request: ApnsRequest): Promise<ApnsResponse>;
  close(): void;
}

const DEFAULT_TIMEOUT_MS = 10_000;

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** ES256 provider token for APNs (`iss` = team id, `kid` = key id), see Apple's "Establishing a token-based connection to APNs". */
export function createApnsJwt(key: KeyObject, keyId: string, teamId: string, issuedAt = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: issuedAt }));
  const signature = createSign("SHA256").update(`${header}.${claims}`).end().sign({ key, dsaEncoding: "ieee-p1363" });
  return `${header}.${claims}.${base64url(signature)}`;
}

export function loadApnsKey(pem: string): KeyObject {
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "ec") throw new Error(`APNs key must be an EC (P-256) private key, got ${key.asymmetricKeyType ?? "unknown"}`);
  return key;
}

/** Caches the signed JWT: APNs accepts tokens up to an hour old and rejects refreshes more often than every 20 minutes. */
export class ApnsTokenSigner {
  private cached: { token: string; issuedAt: number } | null = null;

  constructor(
    private readonly key: KeyObject,
    private readonly keyId: string,
    private readonly teamId: string,
    private readonly maxAgeSec = 50 * 60,
    private readonly now: () => number = Date.now,
  ) {}

  token(): string {
    const issuedAt = Math.floor(this.now() / 1000);
    if (this.cached && issuedAt - this.cached.issuedAt < this.maxAgeSec) return this.cached.token;
    this.cached = { token: createApnsJwt(this.key, this.keyId, this.teamId, issuedAt), issuedAt };
    return this.cached.token;
  }
}

export class Http2ApnsTransport implements ApnsTransport {
  private readonly sessions = new Map<string, ClientHttp2Session>();

  constructor(private readonly timeoutMs = DEFAULT_TIMEOUT_MS) {}

  send(request: ApnsRequest): Promise<ApnsResponse> {
    return new Promise((resolve, reject) => {
      let session: ClientHttp2Session;
      try {
        session = this.session(request.host);
      } catch (error) {
        reject(error);
        return;
      }
      const stream = session.request({
        ":method": "POST",
        ":path": request.path,
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(request.body)),
        ...request.headers,
      });
      const chunks: Buffer[] = [];
      let status = 0;
      let settled = false;
      const finish = (result: { value: ApnsResponse } | { error: Error }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if ("value" in result) resolve(result.value);
        else reject(result.error);
      };
      const timer = setTimeout(() => {
        stream.close(constants.NGHTTP2_CANCEL);
        finish({ error: new Error(`APNs request timed out after ${this.timeoutMs} ms`) });
      }, this.timeoutMs);
      stream.on("response", (headers) => {
        status = Number(headers[":status"] ?? 0);
      });
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => finish({ value: { status, body: Buffer.concat(chunks).toString("utf8") } }));
      stream.on("error", (error: Error) => finish({ error }));
      stream.on("close", () => finish({ error: new Error("APNs stream closed before a response") }));
      stream.end(request.body);
    });
  }

  close(): void {
    for (const session of this.sessions.values()) session.close();
    this.sessions.clear();
  }

  private session(host: string): ClientHttp2Session {
    const existing = this.sessions.get(host);
    if (existing && !existing.closed && !existing.destroyed) return existing;
    const session = connect(`https://${host}:443`);
    const drop = () => {
      if (this.sessions.get(host) === session) this.sessions.delete(host);
    };
    session.on("close", drop);
    session.on("error", drop);
    session.on("goaway", () => session.close());
    this.sessions.set(host, session);
    return session;
  }
}
