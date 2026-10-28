import { describe, expect, test } from "bun:test";
import {
  CLAUDE_BUILTIN_COMMANDS,
  CLAUDE_COMMAND_NAME_PATTERN,
  CLAUDE_COMMAND_SOURCES,
  ClaudeCommandListSchema,
  ClaudeCommandSchema,
  LIMITS,
  restPaths,
  routePatterns,
} from "../src/index";

const command = { name: "deploy", description: "Deploy an app", kind: "skill", source: "managed" } as const;

describe("ClaudeCommandSchema", () => {
  test("accepts skills and commands from every source", () => {
    for (const source of CLAUDE_COMMAND_SOURCES) {
      expect(ClaudeCommandSchema.parse({ ...command, source })).toEqual({ ...command, source });
    }
    expect(ClaudeCommandListSchema.parse([command, { ...command, name: "frontend:review", kind: "command", source: "project" }])).toHaveLength(2);
    expect(ClaudeCommandSchema.parse({ ...command, description: "" }).description).toBe("");
  });

  test("rejects bad names, kinds and sources", () => {
    for (const name of ["", "/deploy", "Deploy", "two words", ":review", "review:", "a::b", "x".repeat(LIMITS.maxNameLength + 1)]) {
      expect(ClaudeCommandSchema.safeParse({ ...command, name }).success).toBe(false);
    }
    expect(ClaudeCommandSchema.safeParse({ ...command, kind: "agent" }).success).toBe(false);
    expect(ClaudeCommandSchema.safeParse({ ...command, source: "plugin" }).success).toBe(false);
    expect(ClaudeCommandSchema.safeParse({ ...command, description: "x".repeat(LIMITS.maxStatusMessageLength + 1) }).success).toBe(false);
  });

  test("built-ins are valid commands", () => {
    for (const { name, description } of CLAUDE_BUILTIN_COMMANDS) {
      expect(CLAUDE_COMMAND_NAME_PATTERN.test(name)).toBe(true);
      expect(ClaudeCommandSchema.safeParse({ name, description, kind: "command", source: "builtin" }).success).toBe(true);
    }
  });

  test("route", () => {
    expect(restPaths.claudeCommands()).toBe("/v1/claude/commands");
    expect(restPaths.claudeCommands({ projectId: "shop" })).toBe("/v1/claude/commands?projectId=shop");
    expect(routePatterns.rest.claudeCommands).toBe("/v1/claude/commands");
  });
});
