import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parsePairingLink } from "@theone/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { stackEndpoint } from "./health";
import { isLoopbackUrl, pairingInfo, readPairing } from "./pairing";
import { generateToken, sandboxImageRef, sandboxStackFromConfig, withSandboxStack } from "./settings";
import { FakeDocker, tempStack, type TempStack } from "./test-support";

let stack: TempStack;
afterEach(() => stack?.cleanup());

describe("stackEndpoint", () => {
  it("derives health candidates per mode", () => {
    expect(stackEndpoint({ THEONE_MODE: "local", THEONE_CONTROLLER_HOST_PORT: "7811" }, {}).candidates).toEqual(["http://127.0.0.1:7811"]);
    expect(stackEndpoint({ THEONE_MODE: "host-tailscale", THEONE_BIND_ADDR: "100.1.2.3" }, {}).candidates).toEqual(["http://100.1.2.3:7700"]);
    const tailnet = stackEndpoint({ THEONE_MODE: "tailscale", THEONE_HOSTNAME: "box", TS_TAILNET_DOMAIN: "t.ts.net" }, { THEONE_TOKEN: "x" });
    expect(tailnet).toMatchObject({ candidates: ["https://box.t.ts.net"], pairingUrl: "https://box.t.ts.net", container: "theone-sandbox-1" });
    expect(tailnet.env.THEONE_TOKEN).toBeUndefined();
  });
});

describe("pairing", () => {
  it("builds a theone://pair link and flags loopback URLs", () => {
    const info = pairingInfo({ apiUrl: "http://127.0.0.1:7700", token: "tok", name: "box", pairingUrl: null });
    expect(info.local).toBe(true);
    expect(parsePairingLink(info.link)).toEqual({ ok: true, value: { url: "http://127.0.0.1:7700", token: "tok", name: "box" } });
    expect(pairingInfo({ apiUrl: "http://127.0.0.1:7700", token: "tok", name: null, pairingUrl: "https://box.t.ts.net" })).toMatchObject({
      url: "https://box.t.ts.net",
      local: false,
    });
    expect(isLoopbackUrl("http://localhost:1")).toBe(true);
  });

  it("falls back to the env-file token when discovery fails", async () => {
    stack = tempStack();
    const context = stack.context(new FakeDocker().deps());
    mkdirSync(dirname(context.envFile), { recursive: true });
    writeFileSync(context.envFile, "THEONE_MODE=local\nTHEONE_TOKEN=abc123\nTHEONE_HOSTNAME=box\n");
    const info = await readPairing(context);
    expect(info).toMatchObject({ url: "http://127.0.0.1:7700", name: "box", local: true });
  });

  it("reports the discovery error when nothing is reachable", async () => {
    stack = tempStack();
    const context = stack.context(
      new FakeDocker().deps({ discover: async () => ({ ok: false, error: "docker is not installed on this machine" }) }),
    );
    await expect(readPairing(context)).rejects.toMatchObject({ code: "unavailable", message: "docker is not installed on this machine" });
  });
});

describe("settings", () => {
  it("reads and writes sandboxStack while preserving other keys", () => {
    const stackConfig = { envFile: "/e", project: "theone", mode: "local" as const, image: "i", builtAt: null, components: ["mono" as const] };
    const data = withSandboxStack({ zoom: 1 }, stackConfig);
    expect(data).toEqual({ zoom: 1, sandboxStack: stackConfig });
    expect(sandboxStackFromConfig(data)).toEqual(stackConfig);
    expect(sandboxStackFromConfig({ sandboxStack: { project: "x" } })).toBeNull();
    expect(withSandboxStack(data, null)).toEqual({ zoom: 1 });
  });

  it("resolves the pull ref from config, then the environment", () => {
    expect(sandboxImageRef({ sandboxImageRef: "a/b:1" }, { MONOLITH_SANDBOX_IMAGE_REF: "c/d:2" })).toBe("a/b:1");
    expect(sandboxImageRef({}, { MONOLITH_SANDBOX_IMAGE_REF: "c/d:2" })).toBe("c/d:2");
    expect(sandboxImageRef({}, {})).toBeNull();
  });

  it("generates URL-safe pairing tokens", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(token);
  });
});
