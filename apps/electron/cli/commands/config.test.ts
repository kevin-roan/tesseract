import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildPairingLink } from "@theone/protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, tempSandbox, type Sandbox } from "../testing";

let sandbox: Sandbox;

function stored(): Record<string, unknown> {
  return JSON.parse(readFileSync(sandbox.configFile, "utf8")) as Record<string, unknown>;
}

function seed(data: Record<string, unknown>): void {
  mkdirSync(dirname(sandbox.configFile), { recursive: true });
  writeFileSync(sandbox.configFile, JSON.stringify(data));
}

beforeEach(() => {
  sandbox = tempSandbox();
});

afterEach(() => sandbox.cleanup());

describe("monolith config", () => {
  it("prints the config path", async () => {
    expect((await runCli(sandbox, ["config", "path"])).out).toEqual([sandbox.configFile]);
  });

  it("sets typed settings and keeps unknown keys", async () => {
    seed({ custom: { keep: true } });
    expect((await runCli(sandbox, ["config", "set", "appearance", "Light"])).code).toBe(0);
    expect((await runCli(sandbox, ["config", "set", "hostShellAutostart", "yes"])).code).toBe(0);
    expect((await runCli(sandbox, ["config", "set", "zoom", "1.25"])).code).toBe(0);
    expect(stored()).toEqual({ custom: { keep: true }, appearance: "light", host_shell_autostart: true, zoom: 1.25 });
    expect((await runCli(sandbox, ["config", "get", "appearance"])).out).toEqual(["light"]);
  });

  it("rejects invalid values and unknown keys without writing", async () => {
    const invalid = await runCli(sandbox, ["config", "set", "zoom", "9"]);
    expect(invalid.code).toBe(64);
    expect(invalid.err[0]).toContain("expected a number between 0.67 and 2");
    const unknown = await runCli(sandbox, ["config", "set", "mystery", "1"]);
    expect(unknown.code).toBe(64);
    expect(unknown.err[0]).toContain("--force");
    expect((await runCli(sandbox, ["config", "set", "mystery", "[1,2]", "--force"])).code).toBe(0);
    expect(stored()).toEqual({ mystery: [1, 2] });
  });

  it("never prints or sets the token directly", async () => {
    seed({ url: "http://127.0.0.1:7700", token: "secret-token-value" });
    const all = await runCli(sandbox, ["config", "get", "--json"]);
    expect(all.out.join("\n")).not.toContain("secret-token-value");
    expect((await runCli(sandbox, ["config", "get", "token"])).out).toEqual(["…"]);
    expect((await runCli(sandbox, ["config", "get", "token", "--reveal"])).out).toEqual(["secret-token-value"]);
    expect((await runCli(sandbox, ["config", "set", "token", "x"])).code).toBe(64);
  });

  it("stores a connection from a pairing link and forgets it again", async () => {
    seed({ tokenSealed: "old", appearance: "dark" });
    const link = buildPairingLink({ url: "http://100.64.0.2:7700", token: "a".repeat(43), name: "studio" });
    expect((await runCli(sandbox, ["config", "set", "link", link])).code).toBe(0);
    expect(stored()).toMatchObject({ url: "http://100.64.0.2:7700", token: "a".repeat(43), name: "studio", appearance: "dark" });
    expect(stored().tokenSealed).toBeUndefined();
    expect((await runCli(sandbox, ["config", "unset", "link"])).code).toBe(0);
    expect(stored()).toEqual({ appearance: "dark" });
  });

  it("reports a missing key as an error", async () => {
    const result = await runCli(sandbox, ["config", "get", "androidAvd", "--json"]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.out.join("\n"))).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});
