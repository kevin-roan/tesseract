import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "../../src/shared/ipc-types";
import { runCli, tempSandbox, type Sandbox } from "../testing";
import { describePairing } from "./pair";

const mocks = vi.hoisted(() => ({ readPairing: vi.fn() }));

vi.mock("../../src/core/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/sandbox")>()),
  readPairing: mocks.readPairing,
}));

const INFO = { link: "tesseract://pair?url=http%3A%2F%2F100.64.0.2%3A7700&token=x", url: "http://100.64.0.2:7700", name: "studio", local: false };

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = tempSandbox();
});

afterEach(() => {
  sandbox.cleanup();
  vi.clearAllMocks();
});

describe("describePairing", () => {
  it("prints the link, the QR code and a local-address warning", () => {
    const lines = describePairing({ ...INFO, local: true }, { qr: true, color: false });
    expect(lines.slice(0, 3)).toEqual(["Pair a phone with studio", "", INFO.link]);
    expect(lines.length).toBeGreaterThan(15);
    expect(lines.at(-1)).toContain("only works on this computer");
  });

  it("can skip the QR code", () => {
    expect(describePairing(INFO, { qr: false, color: false })).toEqual([
      "Pair a phone with studio",
      "",
      INFO.link,
      "",
      "Scan the code with the Tesseract phone app, or open the link on the phone.",
    ]);
  });
});

describe("tesseract pair", () => {
  it("prints the link from the running sandbox", async () => {
    mocks.readPairing.mockResolvedValue(INFO);
    const result = await runCli(sandbox, ["pair", "--json"]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out.join("\n"))).toEqual(INFO);
  });

  it("falls back to the saved connection", async () => {
    mocks.readPairing.mockRejectedValue(new IpcError("unavailable", "no sandbox"));
    mkdirSync(dirname(sandbox.configFile), { recursive: true });
    writeFileSync(sandbox.configFile, JSON.stringify({ url: "http://127.0.0.1:7700", token: "k".repeat(43), name: "laptop" }));
    const result = await runCli(sandbox, ["sandbox", "pair", "--no-qr"]);
    expect(result.code).toBe(0);
    expect(result.out[2]).toMatch(/^tesseract:\/\/pair\?/);
    expect(result.out.at(-1)).toContain("only works on this computer");
  });

  it("explains the sealed token when only the app can read it", async () => {
    mocks.readPairing.mockRejectedValue(new IpcError("unavailable", "no sandbox"));
    mkdirSync(dirname(sandbox.configFile), { recursive: true });
    writeFileSync(sandbox.configFile, JSON.stringify({ url: "http://100.64.0.2:7700", tokenSealed: "djEwAAAA" }));
    const result = await runCli(sandbox, ["pair"]);
    expect(result.code).toBe(1);
    expect(result.err[0]).toContain("system keychain");
    expect(result.err[0]).toContain("(no sandbox)");
  });

  it("reports the discovery error when nothing is saved", async () => {
    mocks.readPairing.mockRejectedValue(new IpcError("unavailable", "no sandbox"));
    const result = await runCli(sandbox, ["pair"]);
    expect(result.code).toBe(1);
    expect(result.err).toEqual(["tesseract: no sandbox"]);
  });
});
