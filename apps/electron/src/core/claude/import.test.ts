import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClaudeImport, ClaudeImportResult } from "@theone/protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ClaudeEnvironment } from "./host";
import { buildClaudeImport, importableFiles, importHostClaude } from "./import";

let home: string;

async function write(path: string, content: string | object | Buffer): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, typeof content === "string" || Buffer.isBuffer(content) ? content : JSON.stringify(content));
}

function environment(overrides: Partial<ClaudeEnvironment> = {}): ClaudeEnvironment {
  return { home, env: {}, platform: "linux", ...overrides };
}

const OAUTH = { accessToken: "sk-a", refreshToken: "rt-a", expiresAt: 1, scopes: ["user"], subscriptionType: "pro" };

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "monolith-test-claude-import-"));
  await write(join(home, ".claude", ".credentials.json"), { claudeAiOauth: OAUTH, other: true });
  await write(join(home, ".claude.json"), {
    oauthAccount: { emailAddress: "you@example.com" },
    userID: "u1",
    projects: { "/secret/path": {} },
    theme: "dark",
  });
  await write(join(home, ".claude", "settings.json"), '{"model":"opus"}');
  await write(join(home, ".claude", "CLAUDE.md"), "# Me");
  await write(join(home, ".claude", "skills", "x", "SKILL.md"), "skill");
  await write(join(home, ".claude", "skills", ".git", "HEAD"), "ref");
  await write(join(home, ".claude", "agents", "bin.dat"), Buffer.from([1, 0, 2]));
  await write(join(home, ".claude", "output-styles", "big.md"), "x".repeat(512 * 1024 + 1));
  await write(join(home, ".claude", "projects", "p.jsonl"), "{}");
  await write(join(home, "elsewhere.md"), "e");
  await symlink(join(home, "elsewhere.md"), join(home, ".claude", "commands-link"));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe("importableFiles", () => {
  it("lists only the importable regular files", async () => {
    expect(await importableFiles(join(home, ".claude"))).toEqual([
      "settings.json",
      "CLAUDE.md",
      "skills/x/SKILL.md",
      "agents/bin.dat",
      "output-styles/big.md",
    ]);
  });
});

describe("buildClaudeImport", () => {
  it("collects credentials, allowed account keys and text files", async () => {
    const plan = await buildClaudeImport(environment());
    expect(plan.body.credentials).toEqual(OAUTH);
    expect(plan.body.account).toEqual({ oauthAccount: { emailAddress: "you@example.com" }, userID: "u1", theme: "dark" });
    expect(plan.body.files?.map((file) => file.path)).toEqual(["settings.json", "CLAUDE.md", "skills/x/SKILL.md"]);
    expect(plan.skipped).toEqual([
      { path: "agents/bin.dat", reason: "not a text file" },
      { path: "output-styles/big.md", reason: "larger than the import limit" },
    ]);
  });

  it("honours the part switches", async () => {
    const plan = await buildClaudeImport(environment(), { credentials: false, files: false });
    expect(plan.body.credentials).toBeUndefined();
    expect(plan.body.files).toBeUndefined();
    expect(plan.body.account).toBeDefined();
  });

  it("reads the macOS keychain only when allowed", async () => {
    await rm(join(home, ".claude", ".credentials.json"));
    const keychain = async () => JSON.stringify({ claudeAiOauth: { accessToken: "from-keychain" } });
    const without = await buildClaudeImport(environment({ platform: "darwin" }), { readKeychain: keychain });
    expect(without.body.credentials).toBeUndefined();
    const withKeychain = await buildClaudeImport(environment({ platform: "darwin" }), { keychain: true, readKeychain: keychain });
    expect(withKeychain.body.credentials).toEqual({ accessToken: "from-keychain" });
    await expect(
      buildClaudeImport(environment({ platform: "darwin" }), { keychain: true, readKeychain: async () => null }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("rejects an unknown account", async () => {
    await expect(buildClaudeImport(environment(), { accountId: "claude-nope" })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("importHostClaude", () => {
  it("posts the plan and returns a summary without secrets", async () => {
    let sent: ClaudeImport | null = null;
    const client = {
      importClaude: async (body: ClaudeImport): Promise<ClaudeImportResult> => {
        sent = body;
        return {
          status: {
            available: true,
            method: "credentials",
            loggedIn: true,
            sources: { oauthToken: false, credentials: true, apiKey: false },
            oauthTokenFromEnv: false,
            account: null,
            subscriptionType: "pro",
            credentialsExpiresAt: null,
            settingsPresent: true,
            configDir: "/home/dev/.claude",
            importedAt: "2026-01-01T00:00:00.000Z",
          },
          written: [".credentials.json", "settings.json"],
          skipped: [{ path: "settings.json#hooks", reason: "dropped" }],
        };
      },
    };
    const summary = await importHostClaude(environment(), client);
    expect(sent).not.toBeNull();
    expect(summary).toMatchObject({ accountId: "claude", credentials: true, account: true, loggedIn: true });
    expect(summary.skipped.map((skip) => skip.path)).toEqual(["agents/bin.dat", "output-styles/big.md", "settings.json#hooks"]);
    expect(JSON.stringify(summary)).not.toContain("sk-a");
  });
});
