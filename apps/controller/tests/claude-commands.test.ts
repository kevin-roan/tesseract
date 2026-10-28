import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_BUILTIN_COMMANDS, ClaudeCommandListSchema, type ClaudeCommand } from "@tesseract/protocol";
import { parseFrontmatter } from "../src/services/claude-commands";
import { makeTempDir, removeTempDirs, startTestController, writeFiles, type TestController } from "./helpers";

let t: TestController;
let home: string;

const skill = (name: string | null, description: string, extra = "") =>
  `---\n${name === null ? "" : `name: ${name}\n`}description: ${description}\n${extra}---\n\n# Body\n`;

async function list(query = ""): Promise<ClaudeCommand[]> {
  const { status, body } = await t.json("GET", `/v1/claude/commands${query}`);
  expect(status).toBe(200);
  return ClaudeCommandListSchema.parse(body);
}

const find = (commands: ClaudeCommand[], name: string) => commands.find((command) => command.name === name);

beforeAll(async () => {
  const workspace = makeTempDir("commands");
  home = makeTempDir("commands-home");
  const managed = makeTempDir("commands-managed");
  const outside = makeTempDir("commands-outside");
  writeFiles(managed, {
    "deploy/SKILL.md": skill("deploy", "Deploy an app (managed)"),
    "send-file/SKILL.md": skill("send-file", "Send a file"),
    "shared/SKILL.md": skill("shared", "managed shared"),
    "compact/SKILL.md": skill("compact", "managed compact"),
  });
  writeFiles(outside, { "SKILL.md": skill("escaped", "outside the root"), "escaped.md": "outside" });
  writeFiles(home, {
    ".claude/skills/shared/SKILL.md": skill("shared", "user shared"),
    ".claude/skills/hidden/SKILL.md": skill("hidden", "not invocable", "user-invocable: false\n"),
    ".claude/skills/Bad Name/SKILL.md": "No frontmatter here",
    ".claude/skills/folded/SKILL.md": "---\ndescription: >\n  Folded over\n  two lines\n---\n",
    ".claude/skills/nofront/SKILL.md": "\n\n## First line of the body\nsecond\n",
    ".claude/commands/standup.md": "---\ndescription: \"Write the standup\"\n---\nBody\n",
    ".claude/commands/git/commit-all.md": "Commit everything\n",
    ".claude/commands/git/deep/squash.md": "Squash commits\n",
    ".claude/commands/notes.txt": "not a command",
    ".claude/commands/UPPER.md": "bad name",
    ".claude-work/commands/work-only.md": "Only on the work account\n",
  });
  symlinkSync(outside, join(home, ".claude/skills/escaped"));
  symlinkSync(join(outside, "escaped.md"), join(home, ".claude/commands/escaped.md"));
  writeFiles(workspace, {
    "projects/app/.claude/skills/shared/SKILL.md": skill("shared", "project shared"),
    "projects/app/.claude/commands/frontend/review.md": "---\ndescription: Review the UI\nargument-hint: <path>\n---\n",
    "projects/app/.claude/commands/deploy.md": "Project deploy command\n",
    "projects/other/.keep": "",
  });
  t = await startTestController({
    workspace,
    env: { HOME: home, CLAUDE_CONFIG_DIR: join(home, ".claude"), TESSERACT_CLAUDE_ACCOUNTS: "work" },
    controller: { claudeCommands: { managedSkillsDir: managed, cacheMs: 0 } },
  });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("parseFrontmatter", () => {
  test("reads flat keys, quotes and block scalars", () => {
    expect(parseFrontmatter("﻿---\r\nname: 'x'\r\ndescription: |\r\n  a\r\n  b\r\nuser-invocable: false\r\n---\r\nbody").data).toEqual({
      name: "x",
      description: "a b",
      "user-invocable": "false",
    });
    expect(parseFrontmatter("no frontmatter")).toEqual({ data: {}, body: "no frontmatter" });
    expect(parseFrontmatter("---\nname: open\n").data).toEqual({});
  });
});

describe("GET /v1/claude/commands", () => {
  test("lists built-ins, managed and user commands without a project", async () => {
    const commands = await list();
    expect(commands.map((command) => command.name)).toEqual([...commands.map((command) => command.name)].sort((a, b) => a.localeCompare(b)));
    for (const { name } of CLAUDE_BUILTIN_COMMANDS.filter((entry) => entry.name !== "compact")) expect(find(commands, name)?.source).toBe("builtin");
    expect(find(commands, "compact")).toEqual({ name: "compact", description: "managed compact", kind: "skill", source: "managed" });
    expect(find(commands, "deploy")).toEqual({ name: "deploy", description: "Deploy an app (managed)", kind: "skill", source: "managed" });
    expect(find(commands, "send-file")?.source).toBe("managed");
    expect(find(commands, "shared")).toEqual({ name: "shared", description: "user shared", kind: "skill", source: "user" });
    expect(find(commands, "folded")?.description).toBe("Folded over two lines");
    expect(find(commands, "nofront")?.description).toBe("First line of the body");
    expect(find(commands, "standup")).toEqual({ name: "standup", description: "Write the standup", kind: "command", source: "user" });
    expect(find(commands, "git:commit-all")).toEqual({ name: "git:commit-all", description: "Commit everything", kind: "command", source: "user" });
    expect(find(commands, "git:deep:squash")?.description).toBe("Squash commits");
    for (const name of ["hidden", "Bad Name", "notes", "UPPER", "escaped", "work-only", "frontend:review"]) expect(find(commands, name)).toBeUndefined();
  });

  test("project commands win over user, managed and built-in ones", async () => {
    const commands = await list("?projectId=app");
    expect(find(commands, "shared")).toEqual({ name: "shared", description: "project shared", kind: "skill", source: "project" });
    expect(find(commands, "deploy")).toEqual({ name: "deploy", description: "Project deploy command", kind: "command", source: "project" });
    expect(find(commands, "frontend:review")).toEqual({ name: "frontend:review", description: "Review the UI", kind: "command", source: "project" });
    expect(find(commands, "standup")?.source).toBe("user");
    expect(new Set(commands.map((command) => command.name)).size).toBe(commands.length);
  });

  test("uses the project's Claude account dir", async () => {
    expect((await t.json("PUT", "/v1/projects/other/claude-account", { accountId: "claude-work" })).status).toBe(200);
    const commands = await list("?projectId=other");
    expect(find(commands, "work-only")).toEqual({ name: "work-only", description: "Only on the work account", kind: "command", source: "user" });
    expect(find(commands, "standup")).toBeUndefined();
    expect(find(commands, "deploy")?.source).toBe("managed");
  });

  test("unknown and invalid projects", async () => {
    expect((await t.json("GET", "/v1/claude/commands?projectId=missing")).status).toBe(404);
    expect((await t.json("GET", "/v1/claude/commands?projectId=..%2Fetc")).status).toBe(400);
  });

  test("needs the bearer token", async () => {
    expect((await fetch(`${t.baseUrl}/v1/claude/commands`)).status).toBe(401);
  });
});
