import { mkdir, mkdtemp, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureClaudeDir, hostClaudeAccounts, readHostClaudeStates, type ClaudeEnvironment } from "./host";

let home: string;

async function write(path: string, content: string | object): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, typeof content === "string" ? content : JSON.stringify(content));
}

function environment(overrides: Partial<ClaudeEnvironment> = {}): ClaudeEnvironment {
  return { home, env: {}, platform: "linux", ...overrides };
}

const EXPIRES = 1_900_000_000_000;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "tesseract-test-claude-"));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe("readHostClaudeStates", () => {
  it("reads the primary login, account and settings without secrets", async () => {
    await write(join(home, ".claude", ".credentials.json"), {
      claudeAiOauth: { accessToken: "sk-secret", refreshToken: "rt-secret", subscriptionType: "max", expiresAt: EXPIRES },
    });
    await write(join(home, ".claude.json"), {
      oauthAccount: { emailAddress: "you@example.com", displayName: "You", organizationName: "Example" },
    });
    await write(join(home, ".claude", "settings.json"), "{}");
    await write(join(home, ".claude", "skills", "a", "SKILL.md"), "a");
    await write(join(home, ".claude", "skills", "b.md"), "b");
    await write(join(home, ".claude", "skills", "node_modules", "x.js"), "x");
    await write(join(home, ".claude", "agents", "one.md"), "1");
    await write(join(home, "outside.md"), "o");
    await symlink(join(home, "outside.md"), join(home, ".claude", "CLAUDE.md"));
    await symlink(join(home, "outside.md"), join(home, ".claude", "commands-link.md"));
    await mkdir(join(home, ".claude", "commands"));
    await symlink(join(home, "outside.md"), join(home, ".claude", "commands", "linked.md"));

    const [primary, ...rest] = await readHostClaudeStates(environment());
    expect(rest).toEqual([]);
    expect(primary).toEqual({
      id: "claude",
      configDir: join(home, ".claude"),
      primary: true,
      login: "signed-in",
      email: "you@example.com",
      displayName: "You",
      organization: "Example",
      subscriptionType: "max",
      expiresAt: EXPIRES,
      settings: { settingsJson: true, claudeMd: false, skills: 2, agents: 1, commands: 0, outputStyles: 0 },
    });
    expect(JSON.stringify(primary)).not.toContain("secret");
  });

  it("finds extra ~/.claude-<name> accounts that hold a login, sorted", async () => {
    await write(join(home, ".claude-work", ".credentials.json"), { claudeAiOauth: { accessToken: "t" } });
    await write(join(home, ".claude-work", ".claude.json"), { oauthAccount: { emailAddress: "work@example.com" } });
    await write(join(home, ".claude-alpha", ".credentials.json"), "not json");
    await mkdir(join(home, ".claude-nologin"));
    await write(join(home, ".claude-UPPER", ".credentials.json"), "{}");
    await write(join(home, ".claude-file"), "x");

    const states = await readHostClaudeStates(environment());
    expect(states.map((state) => [state.id, state.login, state.email])).toEqual([
      ["claude", "missing", null],
      ["claude-alpha", "invalid", null],
      ["claude-work", "signed-in", "work@example.com"],
    ]);
  });

  it("uses CLAUDE_CONFIG_DIR with ~ expansion and its own .claude.json", async () => {
    await write(join(home, "cfg", ".credentials.json"), { claudeAiOauth: { accessToken: "t" } });
    await write(join(home, "cfg", ".claude.json"), { oauthAccount: { emailAddress: "custom@example.com" } });
    await write(join(home, ".claude.json"), { oauthAccount: { emailAddress: "ignored@example.com" } });
    const [primary] = await readHostClaudeStates(environment({ env: { CLAUDE_CONFIG_DIR: "~/cfg" } }));
    expect(primary).toMatchObject({ configDir: join(home, "cfg"), login: "signed-in", email: "custom@example.com" });
  });

  it("skips an extra account that is the primary config dir", async () => {
    await write(join(home, ".claude-main", ".credentials.json"), { claudeAiOauth: { accessToken: "t" } });
    const accounts = await hostClaudeAccounts(environment({ env: { CLAUDE_CONFIG_DIR: join(home, ".claude-main") } }));
    expect(accounts.map((account) => account.id)).toEqual(["claude"]);
  });

  it("reports the macOS keychain when there is no credentials file", async () => {
    const [missing] = await readHostClaudeStates(environment({ platform: "darwin" }));
    expect(missing?.login).toBe("keychain");
    await write(join(home, ".claude", ".credentials.json"), { claudeAiOauth: { accessToken: "t" } });
    const [file] = await readHostClaudeStates(environment({ platform: "darwin" }));
    expect(file?.login).toBe("signed-in");
  });

  it("treats a login without an access token as invalid", async () => {
    await write(join(home, ".claude", ".credentials.json"), { claudeAiOauth: { accessToken: "" } });
    const [state] = await readHostClaudeStates(environment());
    expect(state).toMatchObject({ login: "invalid", subscriptionType: null, expiresAt: null });
  });
});

describe("ensureClaudeDir", () => {
  it("creates ~/.claude with mode 0700 once", async () => {
    expect(await ensureClaudeDir(environment())).toEqual({ path: join(home, ".claude"), created: true });
    if (process.platform !== "win32") expect((await stat(join(home, ".claude"))).mode & 0o777).toBe(0o700);
    expect(await ensureClaudeDir(environment())).toEqual({ path: join(home, ".claude"), created: false });
  });

  it("refuses a file in the way", async () => {
    await write(join(home, ".claude"), "x");
    await expect(ensureClaudeDir(environment())).rejects.toMatchObject({ code: "invalid_argument" });
  });
});
