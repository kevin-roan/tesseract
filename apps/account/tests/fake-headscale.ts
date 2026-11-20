import type { Server } from "bun";

type User = { id: string; name: string; displayName: string; createdAt: string };
type PreAuthKey = { id: string; key: string; user: string; reusable: boolean; ephemeral: boolean; used: boolean; expiration: string; aclTags: string[] };
type Node = { id: string; name: string; givenName: string; ipAddresses: string[]; online: boolean; lastSeen: string; userId: string; preAuthKeyId: string; tags: string[] };

/** In-memory stand-in for the Headscale v0.29 REST API, with the same paths, JSON shapes and constraints. */
export class FakeHeadscale {
  readonly apiKey = "hs-test-api-key";
  users: User[] = [];
  keys: PreAuthKey[] = [];
  nodes: Node[] = [];
  requests: string[] = [];
  failNext = false;
  private seq = 0;
  private server: Server<undefined> | null = null;

  get url(): string {
    return `http://127.0.0.1:${this.server!.port}`;
  }

  start(): this {
    this.server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => this.handle(request) });
    return this;
  }

  async stop(): Promise<void> {
    await this.server?.stop(true);
  }

  /** Simulates `tsnet` joining with a pre-auth key, the way Headscale's registration consumes it. */
  register(authKey: string, hostname: string, online = true): Node {
    const key = this.keys.find((entry) => entry.key === authKey);
    if (!key) throw new Error("unknown key");
    if (key.used && !key.reusable) throw new Error("key already used");
    if (new Date(key.expiration).getTime() < Date.now()) throw new Error("key expired");
    key.used = true;
    const id = this.nextId();
    const node: Node = {
      id,
      name: hostname,
      givenName: hostname,
      ipAddresses: [`100.64.0.${id}`, `fd7a:115c:a1e0::${id}`],
      online,
      lastSeen: online ? new Date().toISOString() : "0001-01-01T00:00:00Z",
      userId: key.user,
      preAuthKeyId: key.id,
      tags: key.aclTags,
    };
    this.nodes.push(node);
    return node;
  }

  private nextId(): string {
    this.seq += 1;
    return String(this.seq);
  }

  private json(body: unknown, status = 200): Response {
    return Response.json(body, { status });
  }

  private error(status: number, message: string): Response {
    return this.json({ code: status === 404 ? 5 : 13, message, details: [] }, status);
  }

  private userProto(user: User) {
    return { id: user.id, name: user.name, createdAt: user.createdAt, displayName: user.displayName, email: "", providerId: "", provider: "", profilePicUrl: "" };
  }

  private nodeProto(node: Node) {
    const user = this.users.find((entry) => entry.id === node.userId)!;
    const key = this.keys.find((entry) => entry.id === node.preAuthKeyId)!;
    return {
      id: node.id,
      machineKey: "mkey:x",
      nodeKey: "nodekey:x",
      discoKey: "discokey:x",
      ipAddresses: node.ipAddresses,
      name: node.name,
      user: this.userProto(user),
      lastSeen: node.lastSeen,
      expiry: null,
      preAuthKey: { user: this.userProto(user), id: key.id, key: "", reusable: key.reusable, ephemeral: key.ephemeral, used: key.used, expiration: key.expiration, createdAt: key.expiration, aclTags: key.aclTags },
      createdAt: node.lastSeen,
      registerMethod: "REGISTER_METHOD_AUTH_KEY",
      givenName: node.givenName,
      online: node.online,
      approvedRoutes: [],
      availableRoutes: [],
      subnetRoutes: [],
      tags: node.tags,
    };
  }

  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (request.headers.get("authorization") !== `Bearer ${this.apiKey}`) return new Response("Unauthorized", { status: 401 });
    if (this.failNext) {
      this.failNext = false;
      return this.error(500, "boom");
    }
    const path = url.pathname;

    if (path === "/api/v1/user" && request.method === "GET") {
      const name = url.searchParams.get("name");
      const users = name ? this.users.filter((user) => user.name === name) : this.users;
      return this.json({ users: users.map((user) => this.userProto(user)) });
    }
    if (path === "/api/v1/user" && request.method === "POST") {
      const body = (await request.json()) as { name: string; displayName?: string };
      if (this.users.some((user) => user.name === body.name)) return this.error(500, "creating user: constraint failed");
      const user = { id: this.nextId(), name: body.name, displayName: body.displayName ?? "", createdAt: new Date().toISOString() };
      this.users.push(user);
      return this.json({ user: this.userProto(user) });
    }
    const userMatch = path.match(/^\/api\/v1\/user\/(\d+)$/);
    if (userMatch && request.method === "DELETE") {
      const id = userMatch[1]!;
      if (!this.users.some((user) => user.id === id)) return this.error(500, "record not found");
      if (this.nodes.some((node) => node.userId === id)) return this.error(500, "user not empty: node(s) found");
      this.keys = this.keys.filter((key) => key.user !== id);
      this.users = this.users.filter((user) => user.id !== id);
      return this.json({});
    }
    if (path === "/api/v1/preauthkey" && request.method === "POST") {
      const body = (await request.json()) as { user?: string | number; reusable?: boolean; ephemeral?: boolean; expiration?: string; aclTags?: string[] };
      const userId = String(body.user ?? "");
      const user = this.users.find((entry) => entry.id === userId);
      if (!user) return this.error(500, "record not found");
      const key: PreAuthKey = {
        id: this.nextId(),
        key: `hskey-auth-${crypto.randomUUID()}`,
        user: userId,
        reusable: body.reusable ?? false,
        ephemeral: body.ephemeral ?? false,
        used: false,
        expiration: body.expiration ?? new Date().toISOString(),
        aclTags: body.aclTags ?? [],
      };
      this.keys.push(key);
      return this.json({
        preAuthKey: { user: this.userProto(user), id: key.id, key: key.key, reusable: key.reusable, ephemeral: key.ephemeral, used: false, expiration: key.expiration, createdAt: new Date().toISOString(), aclTags: key.aclTags },
      });
    }
    if (path === "/api/v1/node" && request.method === "GET") {
      const name = url.searchParams.get("user");
      if (name) {
        const user = this.users.find((entry) => entry.name === name);
        if (!user) return this.error(500, "record not found");
        return this.json({ nodes: this.nodes.filter((node) => node.userId === user.id).map((node) => this.nodeProto(node)) });
      }
      return this.json({ nodes: this.nodes.map((node) => this.nodeProto(node)) });
    }
    const nodeMatch = path.match(/^\/api\/v1\/node\/(\d+)$/);
    if (nodeMatch && request.method === "DELETE") {
      const id = nodeMatch[1]!;
      if (!this.nodes.some((node) => node.id === id)) return this.error(404, "node not found");
      this.nodes = this.nodes.filter((node) => node.id !== id);
      return this.json({});
    }
    return new Response("Not Found", { status: 404 });
  }
}
