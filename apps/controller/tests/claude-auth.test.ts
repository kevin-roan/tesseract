import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TesseractClient } from "@tesseract/client";
import { ClaudeAuthStatusSchema, ClaudeImportResultSchema, LIMITS } from "@tesseract/protocol";
import { ensureDirectories, loadConfig, type Config } from "../src/config";
import { silentLogger } from "../src/core/logger";
import { ClaudeAuthService, importPathError, sanitizeSettings } from "../src/services/claude-auth";
import { makeTempDir, removeTempDirs, startTestController, writeFiles, type TestController } from "./helpers";

const TOKEN = "sk-ant-oat01-abcdefghijklmnopqrstuvwxyz0123456789";

function setup(env: Record<string, string> = {}): { config: Config; service: ClaudeAuthService; home: string } {
  const root = makeTempDir("claude-auth");
  const home = join(root, "home");
  mkdirSync(home, { recursive: true });
  const config = loadConfig({
    TESSERACT_WORKSPACE: join(root, "ws"),
    TESSERACT_CLAUDE_BIN: "/nonexistent/claude",
    CLAUDE_CONFIG_DIR: join(root, "claude"),
    HOME: home,
    ...env,
  });
  ensureDirectories(config);
  return { config, service: new ClaudeAuthService(config, silentLogger), home };
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
const mode = (path: string) => statSync(path).mode & 0o777;

afterAll(removeTempDirs);

describe("config", () => {
  test("global config follows CLAUDE_CONFIG_DIR only when it is set", () => {
    expect(loadConfig({ HOME: "/home/dev" }).claudeGlobalConfig).toBe("/home/dev/.claude.json");
    expect(loadConfig({ HOME: "/home/dev", CLAUDE_CONFIG_DIR: "/srv/claude" }).claudeGlobalConfig).toBe("/srv/claude/.claude.json");
    const config = loadConfig({ TESSERACT_DATA_DIR: "/srv/data", CLAUDE_CODE_OAUTH_TOKEN: "x", ANTHROPIC_API_KEY: " " });
    expect(config.claudeEnvAuth).toEqual({ oauthToken: true, apiKey: false });
  });
});

describe("status", () => {
  test("nothing configured", () => {
    const { service, config } = setup();
    expect(service.status()).toEqual({
      available: false,
      method: "none",
      loggedIn: false,
      sources: { oauthToken: false, credentials: false, apiKey: false },
      oauthTokenFromEnv: false,
      account: null,
      subscriptionType: null,
      credentialsExpiresAt: null,
      settingsPresent: false,
      configDir: config.claudeConfigDir,
      importedAt: null,
    });
  });

  test("reads credentials, account and settings without returning secrets", () => {
    const { service, config } = setup({ ANTHROPIC_API_KEY: "sk-ant-api" });
    writeFiles(config.claudeConfigDir, {
      ".credentials.json": JSON.stringify({ claudeAiOauth: { accessToken: "secret-access", expiresAt: 1_800_000_000_000, subscriptionType: "max" } }),
      ".claude.json": JSON.stringify({ oauthAccount: { emailAddress: "dev@example.com", displayName: "Dev", organizationName: "Org" } }),
      "settings.json": "{}",
    });
    const status = service.status();
    expect(status).toMatchObject({
      method: "credentials",
      loggedIn: true,
      sources: { oauthToken: false, credentials: true, apiKey: true },
      account: { email: "dev@example.com", displayName: "Dev", organization: "Org" },
      subscriptionType: "max",
      credentialsExpiresAt: new Date(1_800_000_000_000).toISOString(),
      settingsPresent: true,
    });
    expect(JSON.stringify(status)).not.toContain("secret-access");
    expect(ClaudeAuthStatusSchema.parse(status)).toEqual(status);
  });

  test("uses $HOME/.claude.json when CLAUDE_CONFIG_DIR is not set", () => {
    const { service, home } = setup({ CLAUDE_CONFIG_DIR: "" });
    writeFileSync(join(home, ".claude.json"), JSON.stringify({ oauthAccount: { emailAddress: "home@example.com" } }));
    expect(service.status().account).toEqual({ email: "home@example.com", displayName: null, organization: null });
    expect(service.globalConfigLabel).toBe("~/.claude.json");
  });

  test("api key alone and malformed files", () => {
    const { service, config } = setup({ ANTHROPIC_API_KEY: "sk" });
    writeFiles(config.claudeConfigDir, { ".credentials.json": "{not json", ".claude.json": "[]" });
    expect(service.status()).toMatchObject({ method: "api_key", sources: { credentials: false }, account: null });
  });
});

describe("env token", () => {
  test("CLAUDE_CODE_OAUTH_TOKEN in the environment wins and is reported as from env", () => {
    const { service, config } = setup({ CLAUDE_CODE_OAUTH_TOKEN: TOKEN });
    writeFiles(config.claudeConfigDir, { ".credentials.json": JSON.stringify({ claudeAiOauth: { accessToken: "a" } }) });
    const status = service.status();
    expect(status).toMatchObject({ method: "oauth_token", loggedIn: true, oauthTokenFromEnv: true, sources: { oauthToken: true, credentials: true } });
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });
});

describe("import", () => {
  test("import paths", () => {
    for (const ok of ["settings.json", "CLAUDE.md", "skills/a/SKILL.md", "agents/x.md", "commands/c.md", "output-styles/s.md"]) {
      expect(importPathError(ok)).toBeNull();
    }
    expect(importPathError("/etc/passwd")).toBe("absolute path");
    expect(importPathError("skills/../../x")).toBe("path traversal");
    expect(importPathError("skills/./a.md")).toBe("path is not normalized");
    expect(importPathError("skills//a.md")).toBe("path is not normalized");
    expect(importPathError("skills/")).toBe("path is not normalized");
    expect(importPathError("skills")).toBe("not an importable path");
    expect(importPathError(".credentials.json")).toBe("not an importable path");
    expect(importPathError("projects/x.jsonl")).toBe("not an importable path");
    expect(importPathError("skills\\a.md")).toBe("invalid characters");
  });

  test("settings keys that run host commands are dropped", () => {
    expect(sanitizeSettings('{"model":"opus","hooks":{},"statusLine":{},"apiKeyHelper":"x"}')).toEqual({
      settings: { model: "opus" },
      dropped: ["hooks", "statusLine", "apiKeyHelper"],
    });
    expect(sanitizeSettings("[]")).toBeNull();
    expect(sanitizeSettings("nope")).toBeNull();
  });

  test("credentials merge keeps other keys and backs up the old file", () => {
    const { service, config } = setup();
    const path = join(config.claudeConfigDir, ".credentials.json");
    writeFiles(config.claudeConfigDir, { ".credentials.json": JSON.stringify({ claudeAiOauth: { accessToken: "old" }, mcpOAuth: { srv: 1 } }) });
    const result = service.import({ credentials: { accessToken: "new", refreshToken: "r", expiresAt: 1, extra: true } });
    expect(result.written).toEqual([".credentials.json"]);
    expect(readJson(path)).toEqual({ claudeAiOauth: { accessToken: "new", refreshToken: "r", expiresAt: 1, extra: true }, mcpOAuth: { srv: 1 } });
    expect(mode(path)).toBe(0o600);
    expect(readJson(`${path}.tesseract-bak`)).toEqual({ claudeAiOauth: { accessToken: "old" }, mcpOAuth: { srv: 1 } });
    expect(result.status).toMatchObject({ method: "credentials" });
    expect(result.status.importedAt).not.toBeNull();
  });

  test("account merges only the allowed keys and keeps projects", () => {
    const { service, config } = setup();
    writeFiles(config.claudeConfigDir, { ".claude.json": JSON.stringify({ projects: { "/workspace": { x: 1 } }, theme: "light" }) });
    const result = service.import({
      account: { oauthAccount: { emailAddress: "a@b.c" }, theme: "dark", projects: {}, primaryApiKey: "k" },
    });
    expect(result.written).toEqual([".claude.json"]);
    expect(result.skipped).toEqual([
      { path: ".claude.json#projects", reason: "not an importable account key" },
      { path: ".claude.json#primaryApiKey", reason: "not an importable account key" },
    ]);
    expect(readJson(config.claudeGlobalConfig)).toEqual({ projects: { "/workspace": { x: 1 } }, theme: "dark", oauthAccount: { emailAddress: "a@b.c" } });
    expect(readJson(`${config.claudeGlobalConfig}.tesseract-bak`).theme).toBe("light");
    expect(result.status.account?.email).toBe("a@b.c");
  });

  test("account creates a missing global config and refuses to replace a broken one", () => {
    const { service, config, home } = setup({ CLAUDE_CONFIG_DIR: "" });
    expect(service.import({ account: { hasCompletedOnboarding: true } }).written).toEqual(["~/.claude.json"]);
    expect(readJson(join(home, ".claude.json"))).toEqual({ hasCompletedOnboarding: true });
    writeFileSync(config.claudeGlobalConfig, "{broken");
    expect(service.import({ account: { theme: "dark" } }).skipped).toEqual([{ path: "~/.claude.json", reason: "the existing file is not a JSON object" }]);
    expect(readFileSync(config.claudeGlobalConfig, "utf8")).toBe("{broken");
  });

  test("files: writes allowed paths, sanitizes settings, skips the rest", () => {
    const { service, config } = setup();
    writeFiles(config.claudeConfigDir, { "settings.json": '{"model":"sonnet"}' });
    const result = service.import({
      files: [
        { path: "settings.json", content: JSON.stringify({ model: "opus", hooks: { Stop: [] }, otelHeadersHelper: "x" }) },
        { path: "skills/deploy/SKILL.md", content: "# deploy" },
        { path: "CLAUDE.md", content: "memory" },
        { path: "../escape.md", content: "x" },
        { path: "/tmp/abs.md", content: "x" },
        { path: "projects/a.jsonl", content: "x" },
      ],
    });
    expect(result.written).toEqual(["settings.json", "skills/deploy/SKILL.md", "CLAUDE.md"]);
    expect(result.skipped).toEqual([
      { path: "settings.json#hooks", reason: "runs host commands or points at host paths" },
      { path: "settings.json#otelHeadersHelper", reason: "runs host commands or points at host paths" },
      { path: "../escape.md", reason: "path traversal" },
      { path: "/tmp/abs.md", reason: "absolute path" },
      { path: "projects/a.jsonl", reason: "not an importable path" },
    ]);
    expect(readJson(join(config.claudeConfigDir, "settings.json"))).toEqual({ model: "opus" });
    expect(readJson(join(config.claudeConfigDir, "settings.json.tesseract-bak"))).toEqual({ model: "sonnet" });
    expect(readFileSync(join(config.claudeConfigDir, "skills/deploy/SKILL.md"), "utf8")).toBe("# deploy");
    expect(result.status.settingsPresent).toBe(true);
  });

  test("settings that are not a JSON object are skipped", () => {
    const { service } = setup();
    expect(service.import({ files: [{ path: "settings.json", content: "[1]" }] })).toMatchObject({
      written: [],
      skipped: [{ path: "settings.json", reason: "not a JSON object" }],
    });
  });

  test("symlinks may not lead out of the config dir", () => {
    const { service, config } = setup();
    const outside = makeTempDir("claude-outside");
    mkdirSync(config.claudeConfigDir, { recursive: true });
    symlinkSync(outside, join(config.claudeConfigDir, "skills"));
    mkdirSync(join(config.claudeConfigDir, "shared"));
    symlinkSync(join(config.claudeConfigDir, "shared"), join(config.claudeConfigDir, "agents"));
    writeFileSync(join(config.claudeConfigDir, "commands"), "file");
    const result = service.import({
      files: [
        { path: "skills/evil/SKILL.md", content: "x" },
        { path: "agents/ok.md", content: "inside" },
        { path: "commands/c.md", content: "x" },
      ],
    });
    expect(result.written).toEqual(["agents/ok.md"]);
    expect(result.skipped).toEqual([
      { path: "skills/evil/SKILL.md", reason: "symlink leaves the config dir" },
      { path: "commands/c.md", reason: "parent is not a directory" },
    ]);
    expect(existsSync(join(outside, "evil"))).toBe(false);
    expect(readFileSync(join(config.claudeConfigDir, "shared", "ok.md"), "utf8")).toBe("inside");
  });

  test("a symlinked target file is replaced, not written through", () => {
    const { service, config } = setup();
    const outside = join(makeTempDir("claude-outside"), "victim.md");
    writeFileSync(outside, "original");
    mkdirSync(config.claudeConfigDir, { recursive: true });
    symlinkSync(outside, join(config.claudeConfigDir, "CLAUDE.md"));
    expect(service.import({ files: [{ path: "CLAUDE.md", content: "new" }] }).written).toEqual(["CLAUDE.md"]);
    expect(readFileSync(outside, "utf8")).toBe("original");
    expect(readFileSync(join(config.claudeConfigDir, "CLAUDE.md"), "utf8")).toBe("new");
  });

  test("records importedAt", () => {
    const { service } = setup();
    expect(service.status().importedAt).toBeNull();
    const { status } = service.import({});
    expect(status.importedAt).not.toBeNull();
    expect(service.status().importedAt).toBe(status.importedAt);
  });
});

describe("over HTTP", () => {
  let t: TestController;
  let client: TesseractClient;

  beforeAll(async () => {
    const workspace = makeTempDir("claude-http");
    writeFiles(join(workspace, "projects", "app"), { "README.md": "app\n" });
    t = await startTestController({ workspace, env: { CLAUDE_CODE_OAUTH_TOKEN: "", ANTHROPIC_API_KEY: "" } });
    client = new TesseractClient({ baseUrl: t.baseUrl, token: t.controller.services.token });
  });

  afterAll(() => t.stop());

  test("the removed token routes are gone", async () => {
    expect((await t.json("POST", "/v1/claude/auth/token", { token: TOKEN })).status).toBe(404);
    expect((await t.json("DELETE", "/v1/claude/auth/token")).status).toBe(404);
  });

  test("status through @tesseract/client; invalid import bodies are 400", async () => {
    const status = await client.claudeAuth();
    expect(status).toMatchObject({ configDir: t.config.claudeConfigDir, oauthTokenFromEnv: false, sources: { oauthToken: false } });
    const bad = await t.json("POST", "/v1/claude/import", { files: [{ path: "CLAUDE.md" }] });
    expect(bad.status).toBe(400);
  });

  test("import through @tesseract/client", async () => {
    const result = await client.importClaude({
      credentials: { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 60_000, subscriptionType: "pro" },
      account: { oauthAccount: { emailAddress: "dev@example.com" } },
      files: [{ path: "CLAUDE.md", content: "# memory" }],
    });
    expect(ClaudeImportResultSchema.parse(result)).toEqual(result);
    expect(result.written).toEqual([".credentials.json", ".claude.json", "CLAUDE.md"]);
    expect(result.status).toMatchObject({ method: "credentials", subscriptionType: "pro", account: { email: "dev@example.com" } });
  });

  test("import accepts bodies above 1 MiB up to the import limit", async () => {
    const content = "x".repeat(LIMITS.maxClaudeImportFileBytes - 1024);
    const files = Array.from({ length: 4 }, (_, index) => ({ path: `commands/big-${index}.md`, content }));
    const result = await client.importClaude({ files });
    expect(result.written).toHaveLength(4);

    const tooBig = Array.from({ length: 17 }, (_, index) => ({ path: `commands/huge-${index}.md`, content }));
    const response = await t.request("POST", "/v1/claude/import", { files: tooBig });
    expect(response.status).toBe(413);
    const other = await t.request("POST", "/v1/processes", JSON.stringify({ command: "x".repeat(1_100_000) }));
    expect(other.status).toBe(413);
  });
});
