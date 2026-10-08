import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readConfig, updateConfig } from "../config";
import { containerRunner, findExecutable } from "./container-cli";
import { isHealthyPayload, pickReachable, probeHealth } from "./health";
import { inputFromPairingLink, normalizeConnectionInput, pairingLinkFor } from "./pairing";
import {
  fileConnection,
  readStoredConnection,
  sealPlainToken,
  shouldSealTokens,
  storeConnection,
  type TokenCipher,
} from "./token-vault";

const TOKEN = "q3Jx0mZ8yWv1_bT7-kLp2sR4nC6dE9fG0hI1jK2lM3n";

const fakeCipher: TokenCipher = {
  available: () => true,
  seal: (plain) => Buffer.from(`sealed:${plain}`).toString("base64"),
  unseal: (sealed) => {
    const text = Buffer.from(sealed, "base64").toString();
    if (!text.startsWith("sealed:")) throw new Error("bad");
    return text.slice("sealed:".length);
  },
};

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "tesseract-test-connection-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("config file compatibility", () => {
  it("round-trips the GTK keys and keeps unknown keys", async () => {
    const file = join(dir, "config.json");
    await writeFile(file, JSON.stringify({ theme: "keep-me", apiUrl: "http://old" }));
    const input = normalizeConnectionInput({ apiUrl: "http://127.0.0.1:7700/v1/", token: ` ${TOKEN} `, name: "rig", pairingUrl: "https://sb.ts.net" });
    expect(input).not.toBeNull();
    await updateConfig(file, (data) => storeConnection(data, input, null));
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    const data = await readConfig(file);
    expect(data).toEqual({ theme: "keep-me", url: "http://127.0.0.1:7700", token: TOKEN, name: "rig", pairingUrl: "https://sb.ts.net" });
    expect(readStoredConnection(data, {}, null)).toEqual({
      apiUrl: "http://127.0.0.1:7700",
      token: TOKEN,
      name: "rig",
      pairingUrl: "https://sb.ts.net",
      source: "file",
    });
    await updateConfig(file, (current) => storeConnection(current, null, null));
    expect(await readConfig(file)).toEqual({ theme: "keep-me" });
  });

  it("falls back to environment variables", () => {
    expect(readStoredConnection({}, {}, null)).toBeNull();
    expect(readStoredConnection({}, { TESSERACT_DESKTOP_URL: "http://127.0.0.1:7700", TESSERACT_TOKEN: TOKEN }, null)?.source).toBe("env");
  });
});

describe("token vault", () => {
  it("seals the token and reads it back", () => {
    const input = { apiUrl: "http://127.0.0.1:7700", token: TOKEN, name: null, pairingUrl: null };
    const data = storeConnection({ zoom: 1 }, input, fakeCipher);
    expect(data.token).toBeUndefined();
    expect(typeof data.tokenSealed).toBe("string");
    expect(fileConnection(data, fakeCipher)?.token).toBe(TOKEN);
    expect(fileConnection(data, null)).toBeNull();
    expect(storeConnection(data, null, fakeCipher)).toEqual({ zoom: 1 });
  });

  it("ignores a sealed token that cannot be decrypted", () => {
    expect(fileConnection({ url: "http://127.0.0.1:7700", tokenSealed: "garbage" }, fakeCipher)).toBeNull();
  });

  it("migrates a plain token", () => {
    const sealed = sealPlainToken({ url: "http://127.0.0.1:7700", token: TOKEN, name: "rig" }, fakeCipher);
    expect(sealed?.token).toBeUndefined();
    expect(fileConnection(sealed ?? {}, fakeCipher)?.name).toBe("rig");
    expect(sealPlainToken({}, fakeCipher)).toBeNull();
  });

  it("only seals outside Linux with the default config file", () => {
    const base = { env: {}, configFile: "/u/config.json", defaultConfigFile: "/u/config.json", test: false, cipher: fakeCipher };
    expect(shouldSealTokens({ ...base, platform: "darwin" })).toBe(true);
    expect(shouldSealTokens({ ...base, platform: "linux" })).toBe(false);
    expect(shouldSealTokens({ ...base, platform: "win32", test: true })).toBe(false);
    expect(shouldSealTokens({ ...base, platform: "win32", env: { TESSERACT_DESKTOP_CONFIG: "/x" } })).toBe(false);
    expect(shouldSealTokens({ ...base, platform: "win32", configFile: "/other.json" })).toBe(false);
    expect(shouldSealTokens({ ...base, platform: "darwin", cipher: { ...fakeCipher, available: () => false } })).toBe(false);
  });
});

describe("pairing", () => {
  it("builds the phone link from the pairing URL", () => {
    const link = pairingLinkFor({ apiUrl: "http://127.0.0.1:7700", token: TOKEN, name: "rig", pairingUrl: "https://sb.ts.net" });
    expect(link).toBe(`tesseract://pair?url=https%3A%2F%2Fsb.ts.net&token=${TOKEN}&name=rig`);
    expect(inputFromPairingLink(link)).toEqual({ ok: true, value: { apiUrl: "https://sb.ts.net", token: TOKEN, name: "rig", pairingUrl: "https://sb.ts.net" } });
    expect(inputFromPairingLink("http://x")).toEqual({ ok: false, error: "Pairing link must start with tesseract://" });
  });

  it("validates connection input like Preferences", () => {
    expect(normalizeConnectionInput({ apiUrl: "ftp://x", token: TOKEN })).toBeNull();
    expect(normalizeConnectionInput({ apiUrl: "http://x", token: "  " })).toBeNull();
    expect(normalizeConnectionInput({ apiUrl: "http://x", token: TOKEN, pairingUrl: "nope" })?.pairingUrl).toBeNull();
  });
});

describe("health probing", () => {
  let server: Server;
  let base = "";
  let body = JSON.stringify({ ok: true, version: "1", protocolVersion: 1, sandboxId: "s" });

  beforeEach(async () => {
    server = createServer((request, response) => {
      if (request.url === "/v1/health") {
        response.setHeader("content-type", "application/json");
        response.end(body);
      } else if (request.url === "/slow/v1/health") {
        setTimeout(() => response.end(body), 500);
      } else {
        response.statusCode = 404;
        response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it("checks ok and the protocol version", async () => {
    expect(await probeHealth(base)).toBe(true);
    body = JSON.stringify({ ok: true, protocolVersion: 2 });
    expect(await probeHealth(base)).toBe(false);
    expect(await probeHealth(`${base}/missing`)).toBe(false);
    expect(await probeHealth(`${base}/slow`, 50)).toBe(false);
    expect(isHealthyPayload(null)).toBe(false);
  });

  it("returns the first candidate in list order", async () => {
    const result = await pickReachable(["a", "b", "c"], async (url) => url !== "a");
    expect(result).toEqual({ url: "b", tried: [["a", "unreachable"], ["b", "ok"]] });
  });
});

describe("container cli", () => {
  it("finds docker before podman on PATH", async () => {
    const bin = join(dir, "bin");
    await mkdir(bin);
    for (const name of ["podman", "docker"]) {
      await writeFile(join(bin, name), "#!/bin/sh\necho \"$0 $@\"\n");
      await chmod(join(bin, name), 0o755);
    }
    expect(findExecutable("docker", { PATH: bin }, "linux")).toBe(join(bin, "docker"));
    expect(findExecutable("docker", { PATH: "" }, "linux")).toBeNull();
    const run = containerRunner({ env: { PATH: bin }, platform: "linux" });
    expect((await run(["ps"], 5_000)).trim()).toBe(`${join(bin, "docker")} ps`);
    await expect(containerRunner({ env: { PATH: "" }, platform: "linux" })(["ps"], 5_000)).rejects.toThrow(
      "docker is not installed on this machine",
    );
  });
});
