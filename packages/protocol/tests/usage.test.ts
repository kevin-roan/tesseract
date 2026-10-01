import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  ClaudeSessionListSchema,
  ClaudeSessionSchema,
  LIMITS,
  restPaths,
  routePatterns,
  SessionsQuerySchema,
  TokenUsageSchema,
  UsageQuerySchema,
  UsageReportSchema,
} from "../src/index";
import { sampleClaudeSession, sampleUsageReport } from "../src/fixtures";

function roundTrip<T extends z.ZodType>(schema: T, value: unknown) {
  const parsed = schema.parse(JSON.parse(JSON.stringify(value)));
  expect(parsed as unknown).toEqual(value);
  return parsed;
}

function rejects(schema: z.ZodType, value: unknown) {
  expect(schema.safeParse(value).success).toBe(false);
}

describe("usage and sessions routes", () => {
  test("paths and query strings", () => {
    expect(restPaths.usage()).toBe("/v1/usage");
    expect(restPaths.usage({ days: 7 })).toBe("/v1/usage?days=7");
    expect(restPaths.sessions()).toBe("/v1/sessions");
    expect(restPaths.sessions({ limit: 5, projectId: "a b" })).toBe("/v1/sessions?limit=5&projectId=a%20b");
  });

  test("route patterns", () => {
    expect(routePatterns.rest.usage).toBe("/v1/usage");
    expect(routePatterns.rest.sessions).toBe("/v1/sessions");
  });
});

describe("usage schemas", () => {
  test("round-trip", () => {
    roundTrip(UsageReportSchema, sampleUsageReport);
    roundTrip(ClaudeSessionSchema, sampleClaudeSession);
    roundTrip(ClaudeSessionListSchema, [sampleClaudeSession]);
    roundTrip(ClaudeSessionSchema, {
      ...sampleClaudeSession,
      projectId: null,
      cwd: null,
      title: null,
      preview: null,
      model: null,
      source: "terminal",
      agentRunId: null,
      terminalId: "trm_1a2b3c4d5e",
      active: true,
    });
  });

  test("rejects bad payloads", () => {
    rejects(TokenUsageSchema, { ...sampleClaudeSession.usage, inputTokens: -1 });
    rejects(TokenUsageSchema, { ...sampleClaudeSession.usage, outputTokens: 1.5 });
    rejects(UsageReportSchema, { ...sampleUsageReport, days: 0 });
    rejects(UsageReportSchema, { ...sampleUsageReport, days: LIMITS.maxUsageDays + 1 });
    rejects(UsageReportSchema, { ...sampleUsageReport, daily: [{ ...sampleUsageReport.daily[0], date: "22/09/2026" }] });
    rejects(UsageReportSchema, { ...sampleUsageReport, totals: { ...sampleUsageReport.totals, messages: -1 } });
    rejects(ClaudeSessionSchema, { ...sampleClaudeSession, source: "web" });
    rejects(ClaudeSessionSchema, { ...sampleClaudeSession, agentRunId: "trm_1a2b3c4d5e" });
    rejects(ClaudeSessionSchema, { ...sampleClaudeSession, lastActiveAt: "yesterday" });
  });

  test("queries coerce strings and enforce limits", () => {
    expect(UsageQuerySchema.parse({})).toEqual({});
    expect(UsageQuerySchema.parse({ days: "7" })).toEqual({ days: 7 });
    rejects(UsageQuerySchema, { days: "0" });
    rejects(UsageQuerySchema, { days: String(LIMITS.maxUsageDays + 1) });
    rejects(UsageQuerySchema, { days: "abc" });
    expect(SessionsQuerySchema.parse({ limit: "5", projectId: "Site" })).toEqual({ limit: 5, projectId: "site" });
    rejects(SessionsQuerySchema, { limit: String(LIMITS.maxSessionsList + 1) });
    rejects(SessionsQuerySchema, { projectId: "../etc" });
  });
});
