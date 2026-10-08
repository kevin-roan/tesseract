import { sampleClaudeAccountList, sampleClaudeAuthStatus } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import type { HostClaudeState } from "../../../../shared/contracts/claude";
import { accountChoices, formatExpiry, hostAccountRows, hostAccountSubtitle, methodLabel, sandboxAuthRows, sandboxDescription, settingsSummary } from "./model";

const NOW = Date.parse("2026-01-01T06:00:00.000Z");
const HOUR = 3_600_000;

const host: HostClaudeState = {
  id: "claude",
  configDir: "/home/dev/.claude",
  primary: true,
  login: "signed-in",
  email: "you@example.com",
  displayName: null,
  organization: "Example Org",
  subscriptionType: "max",
  expiresAt: NOW + 2 * HOUR - 30_000,
  settings: { settingsJson: true, claudeMd: true, skills: 2, agents: 1, commands: 0, outputStyles: 0 },
};

describe("claude preferences model", () => {
  it("describes a host account", () => {
    expect(hostAccountSubtitle(host)).toBe("you@example.com · /home/dev/.claude");
    expect(hostAccountRows(host, NOW)).toEqual([
      { key: "Login", value: "Signed in" },
      { key: "Account", value: "you@example.com · Example Org" },
      { key: "Plan", value: "Max" },
      { key: "Access token", value: "Expires in 1h 59m" },
      { key: "Settings", value: "settings.json · CLAUDE.md · 2 skill files · 1 agent file" },
    ]);
  });

  it("hides expiry and account details for a missing login", () => {
    const rows = hostAccountRows({ ...host, login: "missing", email: null, organization: null, subscriptionType: null }, NOW);
    expect(rows.map((row) => row.value)).toEqual(["Login not found", "—", "—", "—", rows[4]!.value]);
    expect(settingsSummary({ settingsJson: false, claudeMd: false, skills: 0, agents: 0, commands: 0, outputStyles: 0 })).toBe("No settings found");
  });

  it("formats past and near expiries with a one minute floor", () => {
    expect(formatExpiry(NOW + 5_000, NOW)).toBe("Expires in 1m");
    expect(formatExpiry(NOW - 3 * HOUR, NOW)).toBe("Expired 3h ago · Claude Code refreshes it on next use");
    expect(formatExpiry(null, NOW)).toBe("—");
  });

  it("labels the sandbox auth method", () => {
    expect(methodLabel(sampleClaudeAuthStatus)).toBe("Signed in with a long-lived token");
    expect(methodLabel({ ...sampleClaudeAuthStatus, oauthTokenFromEnv: true })).toBe("Signed in with a long-lived token from the environment");
    expect(methodLabel({ ...sampleClaudeAuthStatus, available: false })).toBe("Claude Code is not installed in the sandbox");
    const rows = sandboxAuthRows({ ...sampleClaudeAuthStatus, method: "credentials", credentialsExpiresAt: new Date(NOW + HOUR).toISOString() }, NOW);
    expect(rows[3]).toEqual({ key: "Access token", value: "Expires in 1h" });
    expect(rows[4]).toEqual({ key: "Settings", value: "settings.json present" });
    expect(sandboxDescription("/home/dev/.claude")).toBe("Claude Code inside the sandbox uses this computer's ~/.claude folders (linked) · /home/dev/.claude");
  });

  it("builds account radio choices", () => {
    const list = {
      ...sampleClaudeAccountList,
      accounts: [
        sampleClaudeAccountList.accounts[0]!,
        { ...sampleClaudeAccountList.accounts[1]!, present: false, credentialsExpiresAt: null, subscriptionType: null },
      ],
    };
    const choices = accountChoices(list, Date.parse("2026-01-01T06:00:00.000Z"));
    expect(choices[0]).toEqual({
      id: "claude",
      title: "claude · primary",
      subtitle: "dev@example.com · Example\nMax · Signed in · Expires in 2h\n/home/dev/.claude",
      available: true,
    });
    expect(choices[1]!.subtitle).toBe("dev@work.example · Work\n— · Not linked into the sandbox\n/home/dev/.claude-work");
    expect(choices[1]!.available).toBe(false);
  });
});
