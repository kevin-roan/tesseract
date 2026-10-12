import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgentRunDetailSchema, AgentRunSchema, ClaudeAccountListSchema, ProjectSchema, type AgentRun } from "@tesseract/protocol";
import { loadConfig } from "../src/config";
import { claudeAccountEnv } from "../src/services/claude-accounts";
import { makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

const FAKE_CLAUDE = `#!/usr/bin/env bash
cat > /dev/null
session="sess-$$"
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--resume" ]]; then session="$2"; fi
  shift
done
printf '%s\\n' '{"type":"system","subtype":"init","session_id":"'"$session"'","model":"claude-test"}'
printf '%s\\n' '{"type":"assistant","message":{"content":[{"type":"text","text":"config '"\${CLAUDE_CONFIG_DIR:-inherited}"'"}]},"session_id":"'"$session"'"}'
printf '%s\\n' '{"type":"result","subtype":"success","is_error":false,"result":"ok","usage":{"input_tokens":1,"output_tokens":1},"session_id":"'"$session"'"}'
`;

let t: TestController;
let home: string;

async function finishedRun(body: Record<string, unknown>): Promise<{ run: AgentRun; configText: string }> {
  const { status, body: started } = await t.json("POST", "/v1/agent/runs", body);
  if (status !== 201) throw new Error(`run failed to start: ${status} ${JSON.stringify(started)}`);
  const { id } = AgentRunSchema.parse(started);
  const detail = await waitFor(async () => {
    const parsed = AgentRunDetailSchema.parse((await t.json("GET", `/v1/agent/runs/${id}`)).body);
    return parsed.state === "running" ? null : parsed;
  }, 10_000);
  const text = detail.events.find((event) => event.kind === "text" && event.text.startsWith("config "));
  return { run: detail, configText: text?.kind === "text" ? text.text : "" };
}

beforeAll(async () => {
  const workspace = makeTempDir("accounts");
  home = makeTempDir("accounts-home");
  writeFiles(workspace, { "projects/app/.keep": "" });
  writeFiles(home, {
    ".claude-work/.credentials.json": JSON.stringify({ claudeAiOauth: { accessToken: "secret-access", refreshToken: "secret-refresh", expiresAt: 1_900_000_000_000, subscriptionType: "team" } }),
    ".claude-work/.claude.json": JSON.stringify({ oauthAccount: { emailAddress: "dev@work.example", organizationName: "Work" } }),
    ".claude-work/settings.json": "{}",
  });
  const claude = join(makeTempDir("accounts-bin"), "claude");
  writeFileSync(claude, FAKE_CLAUDE);
  chmodSync(claude, 0o755);
  t = await startTestController({ workspace, env: { HOME: home, TESSERACT_CLAUDE_BIN: claude, TESSERACT_CLAUDE_ACCOUNTS: "work, gone", CLAUDE_CONFIG_DIR: join(home, ".claude") } });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("config", () => {
  test("maps TESSERACT_CLAUDE_ACCOUNTS names to ~/.claude-<name>", () => {
    const config = loadConfig({ HOME: "/home/dev", TESSERACT_CLAUDE_ACCOUNTS: "work personal,work" });
    expect(config.claudeAccounts).toEqual([
      { id: "claude", configDir: "/home/dev/.claude", globalConfig: "/home/dev/.claude.json", env: {} },
      { id: "claude-work", configDir: "/home/dev/.claude-work", globalConfig: "/home/dev/.claude-work/.claude.json", env: { CLAUDE_CONFIG_DIR: "/home/dev/.claude-work" } },
      { id: "claude-personal", configDir: "/home/dev/.claude-personal", globalConfig: "/home/dev/.claude-personal/.claude.json", env: { CLAUDE_CONFIG_DIR: "/home/dev/.claude-personal" } },
    ]);
    expect(() => loadConfig({ TESSERACT_CLAUDE_ACCOUNTS: "../etc" })).toThrow("TESSERACT_CLAUDE_ACCOUNTS");
  });
});

describe("claudeAccountEnv", () => {
  test("keeps the env credentials for the primary and drops them for other accounts", () => {
    const [primary, work] = loadConfig({ HOME: "/home/dev", TESSERACT_CLAUDE_ACCOUNTS: "work" }).claudeAccounts;
    const base = { PATH: "/bin", CLAUDE_CODE_OAUTH_TOKEN: "tok", ANTHROPIC_API_KEY: "key", ANTHROPIC_AUTH_TOKEN: "auth" };
    expect(claudeAccountEnv(primary!, base)).toEqual(base);
    expect(claudeAccountEnv(work!, base)).toEqual({ PATH: "/bin", CLAUDE_CONFIG_DIR: "/home/dev/.claude-work" });
  });
});

describe("accounts", () => {
  test("lists every account without secrets", async () => {
    const { status, body } = await t.json("GET", "/v1/claude/accounts");
    expect(status).toBe(200);
    const list = ClaudeAccountListSchema.parse(body);
    expect(list.defaultAccountId).toBe("claude");
    expect(list.accounts.map((account) => [account.id, account.primary, account.present])).toEqual([
      ["claude", true, false],
      ["claude-work", false, true],
      ["claude-gone", false, false],
    ]);
    expect(list.accounts[1]).toMatchObject({
      loggedIn: true,
      subscriptionType: "team",
      account: { email: "dev@work.example", organization: "Work" },
      settingsPresent: true,
      credentialsExpiresAt: new Date(1_900_000_000_000).toISOString(),
    });
    expect(JSON.stringify(body)).not.toContain("secret-");
  });

  test("rejects unknown, missing and malformed default accounts", async () => {
    expect((await t.json("PUT", "/v1/claude/accounts/default", { accountId: "claude-nope" })).status).toBe(404);
    expect((await t.json("PUT", "/v1/claude/accounts/default", { accountId: "claude-gone" })).status).toBe(400);
    expect((await t.json("PUT", "/v1/claude/accounts/default", { accountId: "work" })).status).toBe(400);
    expect((await t.json("PUT", "/v1/projects/app/claude-account", { accountId: "claude-gone" })).status).toBe(400);
    expect((await t.json("PUT", "/v1/projects/missing/claude-account", { accountId: null })).status).toBe(404);
  });

  test("runs use the project's, then the default account, also when resuming", async () => {
    const list = ClaudeAccountListSchema.parse((await t.json("PUT", "/v1/claude/accounts/default", { accountId: "claude-work" })).body);
    expect(list.defaultAccountId).toBe("claude-work");

    const project = ProjectSchema.parse((await t.json("GET", "/v1/projects/app")).body);
    expect(project.claudeAccountId).toBeNull();
    const work = await finishedRun({ projectId: "app", prompt: "hi" });
    expect(work.run.claudeAccountId).toBe("claude-work");
    expect(work.configText).toBe(`config ${join(home, ".claude-work")}`);

    const pinned = ProjectSchema.parse((await t.json("PUT", "/v1/projects/app/claude-account", { accountId: "claude" })).body);
    expect(pinned.claudeAccountId).toBe("claude");
    const primary = await finishedRun({ projectId: "app", prompt: "hi" });
    expect(primary.run.claudeAccountId).toBe("claude");
    expect(primary.configText).not.toContain(".claude-work");

    const session = work.run.sessionId!;
    writeFiles(home, { [`.claude-work/projects/-app/${session}.jsonl`]: "{}\n", [`.claude-work/projects/-app/${session}/subagents/a.jsonl`]: "{}\n" });
    const resumed = await finishedRun({ projectId: "app", prompt: "again", resumeSessionId: session });
    expect(resumed.run.claudeAccountId).toBe("claude");
    expect(existsSync(join(home, `.claude/projects/-app/${session}.jsonl`))).toBe(true);
    expect(existsSync(join(home, `.claude/projects/-app/${session}/subagents/a.jsonl`))).toBe(true);
    expect(existsSync(join(home, `.claude-work/projects/-app/${session}.jsonl`))).toBe(false);

    const cleared = ProjectSchema.parse((await t.json("PUT", "/v1/projects/app/claude-account", { accountId: null })).body);
    expect(cleared.claudeAccountId).toBeNull();
    expect((await finishedRun({ prompt: "workspace" })).run.claudeAccountId).toBe("claude-work");
  }, 30_000);
});
