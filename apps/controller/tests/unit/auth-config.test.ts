import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PORT, LIMITS } from "@tesseract/protocol";
import { TicketStore } from "../../src/auth/tickets";
import { generateToken, mirrorTokenToFile, readTokenFile, resolveToken, rotateToken, TokenError, tokensEqual } from "../../src/auth/token";
import { ConfigError, ensureDirectories, loadConfig, localApiUrl, type Config } from "../../src/config";
import { makeTempDir, removeTempDirs } from "../helpers";

afterEach(removeTempDirs);

const VALID_TOKEN = "unit-test-token-0123456789abcdefghijklmnop";

function configFor(workspace: string, env: Record<string, string> = {}): Config {
  return loadConfig({ TESSERACT_WORKSPACE: workspace, ...env });
}

describe("TicketStore", () => {
  test("issues unique url-safe tickets with an expiry", () => {
    let now = 1_000;
    const store = new TicketStore(500, () => now);
    const a = store.issue();
    const b = store.issue();
    expect(a.ticket).not.toBe(b.ticket);
    expect(a.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.expiresAt).toBe(new Date(1_500).toISOString());
    expect(store.size).toBe(2);
    now = 1_499;
    expect(store.consume(a.ticket)).toBe(true);
    expect(store.consume(a.ticket)).toBe(false);
  });

  test("expired tickets are refused and removed on first use, pruned on issue", () => {
    let now = 0;
    const store = new TicketStore(100, () => now);
    const expired = store.issue();
    const pruned = store.issue();
    now = 100;
    expect(store.consume(expired.ticket)).toBe(false);
    expect(store.size).toBe(1);
    store.issue();
    expect(store.size).toBe(1);
    expect(store.consume(pruned.ticket)).toBe(false);
  });

  test("rejects empty and unknown input", () => {
    const store = new TicketStore();
    for (const value of [null, undefined, "", "unknown"]) expect(store.consume(value)).toBe(false);
  });

  test("defaults to the protocol TTL", () => {
    const store = new TicketStore();
    const { expiresAt } = store.issue();
    const remaining = Date.parse(expiresAt) - Date.now();
    expect(remaining).toBeGreaterThan(LIMITS.ticketTtlMs - 5_000);
    expect(remaining).toBeLessThanOrEqual(LIMITS.ticketTtlMs);
  });

  test("caps outstanding tickets by evicting the oldest", () => {
    const store = new TicketStore(60_000, () => 0);
    const first = store.issue();
    const second = store.issue();
    for (let i = 0; i < 9_999; i += 1) store.issue();
    expect(store.size).toBe(10_000);
    expect(store.consume(first.ticket)).toBe(false);
    expect(store.consume(second.ticket)).toBe(true);
  });
});

describe("token", () => {
  test("generateToken and tokensEqual", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokensEqual(token, token)).toBe(true);
    expect(tokensEqual(token, `${token}x`)).toBe(false);
    expect(tokensEqual("", token)).toBe(false);
  });

  test("readTokenFile: missing, blank, valid and invalid", () => {
    const dir = makeTempDir("token");
    const path = join(dir, "token");
    expect(readTokenFile(path)).toBeNull();
    writeFileSync(path, "  \n");
    expect(readTokenFile(path)).toBeNull();
    writeFileSync(path, `${VALID_TOKEN}\n`);
    expect(readTokenFile(path)).toBe(VALID_TOKEN);
    writeFileSync(path, "has spaces inside\n");
    expect(() => readTokenFile(path)).toThrow(TokenError);
  });

  test("resolveToken prefers the environment, then the file, then generates", () => {
    const workspace = makeTempDir("token");
    const fromEnv = configFor(workspace, { TESSERACT_TOKEN: VALID_TOKEN });
    expect(resolveToken(fromEnv, { create: true })).toEqual({ token: VALID_TOKEN, source: "env" });

    const config = configFor(workspace);
    expect(resolveToken(config, { create: false })).toBeNull();
    const generated = resolveToken(config, { create: true });
    expect(generated?.source).toBe("generated");
    expect(statSync(config.tokenFile).mode & 0o777).toBe(0o600);
    expect(statSync(config.dataDir).mode & 0o777).toBe(0o700);
    expect(resolveToken(config, { create: true })).toEqual({ token: generated?.token ?? "", source: "file" });
  });

  test("resolveToken reports a token file it can neither read nor replace", () => {
    const workspace = makeTempDir("token");
    const config = configFor(workspace);
    mkdirSync(config.dataDir, { recursive: true });
    writeFileSync(config.tokenFile, "\n");
    expect(() => resolveToken(config, { create: true })).toThrow(/Could not read the token file/);
  });

  test("resolveToken surfaces errors other than an existing file", () => {
    const workspace = makeTempDir("token");
    const blocker = join(workspace, "blocker");
    writeFileSync(blocker, "");
    const config = configFor(workspace, { TESSERACT_TOKEN_FILE: join(blocker, "token") });
    expect(() => resolveToken(config, { create: true })).toThrow();
  });

  test("rotateToken and mirrorTokenToFile write atomically with mode 0600", () => {
    const workspace = makeTempDir("token");
    const config = configFor(workspace);
    const rotated = rotateToken(config);
    expect(readFileSync(config.tokenFile, "utf8")).toBe(`${rotated}\n`);
    expect(statSync(config.tokenFile).mode & 0o777).toBe(0o600);
    expect(mirrorTokenToFile(config, rotated)).toBe(false);
    expect(mirrorTokenToFile(config, VALID_TOKEN)).toBe(true);
    writeFileSync(config.tokenFile, "not valid at all\n");
    expect(mirrorTokenToFile(config, VALID_TOKEN)).toBe(true);
    expect(readTokenFile(config.tokenFile)).toBe(VALID_TOKEN);
  });
});

describe("loadConfig", () => {
  test("defaults", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      host: "0.0.0.0",
      port: DEFAULT_PORT,
      workspace: "/workspace",
      projectsDir: "/workspace/projects",
      artifactsDir: "/workspace/artifacts",
      agentDir: "/workspace/.agent",
      dataDir: "/workspace/.agent/controller",
      logsDir: "/workspace/.agent/controller/logs",
      dbPath: "/workspace/.agent/controller/state.db",
      tokenFile: "/workspace/.agent/controller/token",
      tokenFromEnv: null,
      display: ":1",
      vncHost: "127.0.0.1",
      vncPort: 5901,
      vncPassword: null,
      chromiumDebugPort: 9222,
      claudeBin: "claude",
      claudePermissionMode: "bypassPermissions",
      tailscaleSocket: "/run/tailscale/tailscaled.sock",
      logLevel: "info",
      corsOrigins: ["*"],
      shell: ["bash", "-l"],
    });
    expect(config.publicUrl).toBe(`http://127.0.0.1:${DEFAULT_PORT}`);
    expect(config.sandboxId).toBe(config.hostname);
  });

  test("reads and trims every variable", () => {
    const config = loadConfig({
      TESSERACT_HOST: " 127.0.0.1 ",
      TESSERACT_PORT: "0",
      TESSERACT_WORKSPACE: "/srv/ws/../ws",
      TESSERACT_DATA_DIR: "/srv/data",
      TESSERACT_TOKEN_FILE: "/srv/secret/token",
      TESSERACT_TOKEN: VALID_TOKEN,
      TESSERACT_PUBLIC_URL: "https://box.example.ts.net",
      TESSERACT_DISPLAY: "host:2.0",
      TESSERACT_VNC_HOST: "vnc",
      TESSERACT_VNC_PORT: "5902",
      TESSERACT_VNC_PASSWORD: "pw",
      TESSERACT_CHROMIUM_DEBUG_PORT: "9333",
      TESSERACT_CLAUDE_BIN: "/opt/claude",
      TESSERACT_CLAUDE_PERMISSION_MODE: "acceptEdits",
      TESSERACT_TAILSCALE_SOCKET: " /var/run/tailscale/tailscaled.sock ",
      TESSERACT_SANDBOX_ID: "box",
      TESSERACT_LOG_LEVEL: "debug",
      TESSERACT_CORS_ORIGINS: " https://a.example , ,https://b.example ",
      SHELL: "/bin/zsh",
    });
    expect(config).toMatchObject({
      host: "127.0.0.1",
      port: 0,
      workspace: "/srv/ws",
      dataDir: "/srv/data",
      logsDir: "/srv/data/logs",
      tokenFile: "/srv/secret/token",
      tokenFromEnv: VALID_TOKEN,
      display: "host:2.0",
      vncHost: "vnc",
      vncPort: 5902,
      vncPassword: "pw",
      chromiumDebugPort: 9333,
      claudeBin: "/opt/claude",
      claudePermissionMode: "acceptEdits",
      tailscaleSocket: "/var/run/tailscale/tailscaled.sock",
      sandboxId: "box",
      logLevel: "debug",
      corsOrigins: ["https://a.example", "https://b.example"],
      shell: ["/bin/zsh", "-l"],
    });
    expect(config.publicUrl).toStartWith("https://box.example.ts.net");
    expect(loadConfig({ TESSERACT_PORT: "0" }).publicUrl).toBe(`http://127.0.0.1:${DEFAULT_PORT}`);
    expect(loadConfig({ TESSERACT_CORS_ORIGINS: " , " }).corsOrigins).toEqual(["*"]);
  });

  test("rejects invalid values with a ConfigError naming the variable", () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ TESSERACT_HOST: "bad host" }, "TESSERACT_HOST"],
      [{ TESSERACT_HOST: "a;b" }, "TESSERACT_HOST"],
      [{ TESSERACT_PORT: "65536" }, "TESSERACT_PORT"],
      [{ TESSERACT_PORT: "-1" }, "TESSERACT_PORT"],
      [{ TESSERACT_PORT: "80.5" }, "TESSERACT_PORT"],
      [{ TESSERACT_PORT: "0x50" }, "TESSERACT_PORT"],
      [{ TESSERACT_VNC_PORT: "0" }, "TESSERACT_VNC_PORT"],
      [{ TESSERACT_CHROMIUM_DEBUG_PORT: "0" }, "TESSERACT_CHROMIUM_DEBUG_PORT"],
      [{ TESSERACT_WORKSPACE: "relative/path" }, "TESSERACT_WORKSPACE"],
      [{ TESSERACT_DATA_DIR: "data" }, "TESSERACT_DATA_DIR"],
      [{ TESSERACT_TOKEN_FILE: "token" }, "TESSERACT_TOKEN_FILE"],
      [{ TESSERACT_TAILSCALE_SOCKET: "tailscaled.sock" }, "TESSERACT_TAILSCALE_SOCKET"],
      [{ TESSERACT_TOKEN: "has space" }, "TESSERACT_TOKEN"],
      [{ TESSERACT_PUBLIC_URL: "not a url" }, "TESSERACT_PUBLIC_URL"],
      [{ TESSERACT_DISPLAY: "1" }, "TESSERACT_DISPLAY"],
      [{ TESSERACT_DISPLAY: ":1;rm" }, "TESSERACT_DISPLAY"],
      [{ TESSERACT_CLAUDE_PERMISSION_MODE: "--dangerous" }, "TESSERACT_CLAUDE_PERMISSION_MODE"],
      [{ TESSERACT_LOG_LEVEL: "trace" }, "TESSERACT_LOG_LEVEL"],
    ];
    for (const [env, name] of cases) {
      let caught: unknown;
      try {
        loadConfig(env);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ConfigError);
      expect((caught as Error).message).toContain(name);
    }
  });

  test("blank values fall back to defaults", () => {
    expect(loadConfig({ TESSERACT_PORT: "  ", TESSERACT_LOG_LEVEL: "", TESSERACT_TOKEN: " " })).toMatchObject({
      port: DEFAULT_PORT,
      logLevel: "info",
      tokenFromEnv: null,
    });
  });

  test("the Claude config dir follows CLAUDE_CONFIG_DIR, else HOME", () => {
    expect(loadConfig({ HOME: "/home/dev" }).claudeConfigDir).toBe("/home/dev/.claude");
    expect(loadConfig({ HOME: "/home/dev", CLAUDE_CONFIG_DIR: " /srv/claude/ " }).claudeConfigDir).toBe("/srv/claude");
    expect(() => loadConfig({ CLAUDE_CONFIG_DIR: "claude" })).toThrow(ConfigError);
  });
});

describe("localApiUrl and ensureDirectories", () => {
  test("wildcards map to loopback and IPv6 is bracketed", () => {
    const base = loadConfig({});
    expect(localApiUrl({ ...base, host: "0.0.0.0", port: 1234 })).toBe("http://127.0.0.1:1234");
    expect(localApiUrl({ ...base, host: "::", port: 1234 })).toBe("http://127.0.0.1:1234");
    expect(localApiUrl({ ...base, host: "[::]", port: 1234 })).toBe("http://127.0.0.1:1234");
    expect(localApiUrl({ ...base, host: "::1", port: 1234 })).toBe("http://[::1]:1234");
    expect(localApiUrl({ ...base, host: "[::1]", port: 1234 })).toBe("http://[::1]:1234");
    expect(localApiUrl({ ...base, host: "100.64.0.1", port: 0 })).toBe(`http://100.64.0.1:${DEFAULT_PORT}`);
  });

  test("creates the workspace layout with a private data dir", () => {
    const workspace = join(makeTempDir("dirs"), "ws");
    const config = configFor(workspace);
    ensureDirectories(config);
    ensureDirectories(config);
    for (const dir of [config.workspace, config.projectsDir, config.artifactsDir, config.agentDir, config.logsDir]) {
      expect(statSync(dir).isDirectory()).toBe(true);
    }
    expect(statSync(config.dataDir).mode & 0o777).toBe(0o700);
    expect(statSync(config.logsDir).mode & 0o777).toBe(0o700);
  });
});
