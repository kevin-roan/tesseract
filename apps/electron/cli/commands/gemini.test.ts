import { mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, tempSandbox, type Sandbox } from "../testing";

const TOKEN = "t".repeat(43);
const STATUS = {
  profile: "eco",
  profiles: [],
  engine: "whisper.cpp",
  ready: true,
  reason: null,
  model: "base",
  cpus: 4,
  busy: false,
  queued: 0,
  gemini: { configured: true, model: "gemini-2.5-flash", source: "settings" },
};

let sandbox: Sandbox;
let server: Server;
let requests: Array<{ method?: string; url?: string; auth?: string; body: unknown }>;

beforeEach(async () => {
  sandbox = tempSandbox();
  requests = [];
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null });
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(STATUS));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  mkdirSync(dirname(sandbox.configFile), { recursive: true });
  writeFileSync(sandbox.configFile, JSON.stringify({ url: `http://127.0.0.1:${port}`, token: TOKEN, name: "studio" }));
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  sandbox.cleanup();
});

describe("tesseract --gemini-key", () => {
  it("saves the key on the paired sandbox", async () => {
    const result = await runCli(sandbox, ["--gemini-key= AIza-test-key "]);
    expect(result.code).toBe(0);
    expect(result.out).toEqual(["Gemini API key saved on studio"]);
    expect(requests).toEqual([{ method: "PUT", url: "/v1/stt", auth: `Bearer ${TOKEN}`, body: { geminiApiKey: "AIza-test-key" } }]);
  });

  it("never echoes the key and rejects an empty one", async () => {
    const saved = await runCli(sandbox, ["--gemini-key=AIza-test-key", "--json"]);
    expect(saved.out.join("\n")).not.toContain("AIza-test-key");
    const empty = await runCli(sandbox, ["--gemini-key="]);
    expect(empty.code).toBe(64);
    expect(requests).toHaveLength(1);
  });
});
