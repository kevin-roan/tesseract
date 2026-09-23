import { describe, expect, test } from "bun:test";
import { ApiError } from "@theone/client";
import { HealthSchema, parsePairingLink, SandboxStatusSchema, wsPaths } from "@theone/protocol";
import { client, createClient, e2e, SECONDS } from "./lib/env";
import { exec, execOk } from "./lib/sandbox";
import { probeSocket } from "./lib/socket";

const REQUIRED_TOOLS = ["node", "bun", "git", "python3", "wine", "java", "claude"];

describe("health and status", () => {
  test("health is public and well formed", async () => {
    const response = await fetch(`${e2e.url}/v1/health`);
    expect(response.status).toBe(200);
    const health = HealthSchema.parse(await response.json());
    expect(health).toMatchObject({ ok: true, protocolVersion: 1, sandboxId: e2e.project });
  });

  test("status reports the display, VNC and tool versions", async () => {
    const status = SandboxStatusSchema.parse(await client.status());
    expect(status.sandboxId).toBe(e2e.project);
    expect(status.display.available).toBe(true);
    expect(status.display.vnc.available).toBe(true);
    expect(status.display.vnc.password).toBe(e2e.vncPassword);
    expect(status.display.width).toBeGreaterThan(0);
    expect(status.resources.cpu.cores).toBeGreaterThan(0);
    expect(status.resources.memory.totalBytes).toBeGreaterThan(0);
    const versions = Object.fromEntries(status.tools.map((tool) => [tool.name, tool.version]));
    for (const name of REQUIRED_TOOLS) {
      expect({ name, version: versions[name] ?? null }).toEqual({ name, version: expect.stringMatching(/\d/) });
    }
  });
});

describe("pairing", () => {
  test("pair --json yields a link whose token authenticates", async () => {
    const output = await execOk(["theone-controller", "pair", "--json"]);
    const { link } = JSON.parse(output) as { link: string };
    const parsed = parsePairingLink(link);
    if (!parsed.ok) throw new Error(`pairing link did not parse: ${parsed.error.message}`);
    expect(parsed.value.url).toBe(e2e.url);
    expect(parsed.value.name).toBe(e2e.project);
    const status = await createClient(parsed.value.token).status();
    expect(status.sandboxId).toBe(e2e.project);
  });
});

describe("auth", () => {
  test("REST without a token is rejected", async () => {
    const response = await fetch(`${e2e.url}/v1/status`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  test("REST with a wrong token is rejected", async () => {
    const error = await createClient("not-the-token").status().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });

  test("a ticket is not a bearer token", async () => {
    const { ticket } = await client.createTicket();
    const response = await fetch(`${e2e.url}/v1/status?ticket=${ticket}`);
    expect(response.status).toBe(401);
  });

  test("tickets are single use", async () => {
    const { ticket } = await client.createTicket();
    const url = client.wsUrl(wsPaths.events(), ticket);
    const first = await probeSocket(url);
    expect(first.opened).toBe(true);
    expect(JSON.parse(String(first.first))).toMatchObject({ type: "hello", sandboxId: e2e.project });
    const second = await probeSocket(url);
    expect(second.opened).toBe(false);
  });

  test("websockets without a valid ticket are refused", async () => {
    const missing = await probeSocket(`${e2e.url.replace(/^http/, "ws")}${wsPaths.events()}`);
    expect(missing.opened).toBe(false);
    const forged = await probeSocket(client.wsUrl(wsPaths.events(), "forged-ticket"));
    expect(forged.opened).toBe(false);
  });
});

describe("browser pages and the VNC bridge", () => {
  test("the VNC bridge speaks RFB over the binary subprotocol", async () => {
    const { ticket } = await client.createTicket();
    const probe = await probeSocket(client.wsUrl(wsPaths.vnc(), ticket), ["binary"]);
    expect(probe.opened).toBe(true);
    expect(probe.protocol).toBe("binary");
    expect(probe.first).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(probe.first as Uint8Array)).toStartWith("RFB 003.00");
  });

  test("the raw VNC port answers with an RFB banner", async () => {
    const banner = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no RFB banner")), 10 * SECONDS);
      void Bun.connect({
        hostname: "127.0.0.1",
        port: e2e.vncPort,
        socket: {
          data(socket, data) {
            clearTimeout(timer);
            socket.end();
            resolve(new TextDecoder().decode(data));
          },
          error(_socket, error) {
            clearTimeout(timer);
            reject(error);
          },
        },
      });
    });
    expect(banner).toStartWith("RFB 003.00");
  });

  for (const page of ["/ui/terminal", "/ui/vnc"]) {
    test(`${page} and its assets are served`, async () => {
      const response = await fetch(`${e2e.url}${page}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).not.toContain(e2e.token);
      expect(html).not.toContain(e2e.vncPassword);
      const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((match) => match[1] ?? "");
      expect(assets.length).toBeGreaterThanOrEqual(2);
      for (const asset of assets) {
        const assetResponse = await fetch(`${e2e.url}${asset}`);
        expect({ asset, status: assetResponse.status }).toEqual({ asset, status: 200 });
        expect((await assetResponse.arrayBuffer()).byteLength).toBeGreaterThan(0);
      }
    });
  }
});

describe("doctor", () => {
  test(
    "theone-doctor passes",
    async () => {
      const result = await exec(["theone-doctor"]);
      if (result.code !== 0) throw new Error(`theone-doctor exited ${result.code}\n${result.stdout}\n${result.stderr}`);
      expect(result.stdout).toMatch(/0 failed/);
      expect(result.stdout).not.toContain(e2e.token);
      expect(result.stdout).not.toContain(e2e.vncPassword);
    },
    60 * SECONDS,
  );
});
