/**
 * Client for the Headscale v0.29 REST API (grpc-gateway over `proto/headscale/v1`). JSON fields are lowerCamelCase,
 * uint64 ids are strings and timestamps are RFC 3339.
 */

export type HeadscaleUser = { id: string; name: string };

export type HeadscalePreAuthKey = { id: string; key: string; expiration: string | null; aclTags: string[] };

export type HeadscaleNode = {
  id: string;
  name: string;
  givenName: string;
  ipAddresses: string[];
  online: boolean;
  lastSeen: string | null;
  tags: string[];
  userId: string | null;
  preAuthKeyId: string | null;
};

export type CreatePreAuthKeyInput = {
  userId: string;
  expiration: Date;
  aclTags: string[];
};

export interface HeadscaleClient {
  findUser(name: string): Promise<HeadscaleUser | null>;
  createUser(name: string, displayName: string | null): Promise<HeadscaleUser>;
  deleteUser(id: string): Promise<void>;
  createPreAuthKey(input: CreatePreAuthKeyInput): Promise<HeadscalePreAuthKey>;
  listNodes(userName: string): Promise<HeadscaleNode[]>;
  deleteNode(id: string): Promise<void>;
}

export class HeadscaleError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HeadscaleError";
  }
}

type RawUser = { id?: string | number; name?: string };
type RawPreAuthKey = { id?: string | number; key?: string; expiration?: string | null; aclTags?: string[] };
type RawNode = {
  id?: string | number;
  name?: string;
  givenName?: string;
  ipAddresses?: string[];
  online?: boolean;
  lastSeen?: string | null;
  tags?: string[];
  user?: RawUser | null;
  preAuthKey?: RawPreAuthKey | null;
};

function timestamp(raw: string | null | undefined): string | null {
  if (!raw || raw.startsWith("0001-")) return null;
  return raw;
}

function id(raw: string | number | undefined): string {
  if (raw === undefined || raw === null || raw === "") throw new HeadscaleError(502, "Headscale response is missing an id");
  return String(raw);
}

function toUser(raw: RawUser): HeadscaleUser {
  return { id: id(raw.id), name: raw.name ?? "" };
}

function toNode(raw: RawNode): HeadscaleNode {
  const preAuthKeyId = raw.preAuthKey?.id;
  return {
    id: id(raw.id),
    name: raw.name ?? "",
    givenName: raw.givenName ?? "",
    ipAddresses: raw.ipAddresses ?? [],
    online: raw.online === true,
    lastSeen: timestamp(raw.lastSeen),
    tags: raw.tags ?? [],
    userId: raw.user?.id !== undefined && raw.user.id !== "0" && raw.user.id !== 0 ? String(raw.user.id) : null,
    preAuthKeyId: preAuthKeyId !== undefined && preAuthKeyId !== "0" && preAuthKeyId !== 0 ? String(preAuthKeyId) : null,
  };
}

export function createHeadscaleClient(baseUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): HeadscaleClient {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new HeadscaleError(502, `Headscale unreachable: ${(error as Error).message}`);
    }
    const text = await response.text();
    if (!response.ok) {
      let message = text.slice(0, 500);
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {}
      throw new HeadscaleError(response.status, `Headscale ${method} ${path} failed (${response.status}): ${message}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  return {
    async findUser(name) {
      const result = await call<{ users?: RawUser[] }>("GET", `/api/v1/user?name=${encodeURIComponent(name)}`);
      const match = (result.users ?? []).find((user) => user.name === name);
      return match ? toUser(match) : null;
    },
    async createUser(name, displayName) {
      const result = await call<{ user?: RawUser }>("POST", "/api/v1/user", {
        name,
        ...(displayName ? { displayName } : {}),
      });
      if (!result.user) throw new HeadscaleError(502, "Headscale did not return the created user");
      return toUser(result.user);
    },
    async deleteUser(userId) {
      await call("DELETE", `/api/v1/user/${encodeURIComponent(userId)}`);
    },
    async createPreAuthKey(input) {
      const result = await call<{ preAuthKey?: RawPreAuthKey }>("POST", "/api/v1/preauthkey", {
        user: input.userId,
        reusable: false,
        ephemeral: false,
        expiration: input.expiration.toISOString(),
        aclTags: input.aclTags,
      });
      const key = result.preAuthKey;
      if (!key?.key) throw new HeadscaleError(502, "Headscale did not return a pre-auth key");
      return { id: id(key.id), key: key.key, expiration: timestamp(key.expiration), aclTags: key.aclTags ?? [] };
    },
    async listNodes(userName) {
      const result = await call<{ nodes?: RawNode[] }>("GET", `/api/v1/node?user=${encodeURIComponent(userName)}`);
      return (result.nodes ?? []).map(toNode);
    },
    async deleteNode(nodeId) {
      await call("DELETE", `/api/v1/node/${encodeURIComponent(nodeId)}`);
    },
  };
}
