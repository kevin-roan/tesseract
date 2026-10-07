import { describe, expect, it } from "vitest";
import { claudeAccount } from "../../fixtures/onboarding-final/data";
import { capitalizePlan, formatUptime } from "./format";
import { CLAUDE_LABELS } from "./labels";
import { claudeView, isFolderMissing, nextFolderMissing, settingsSummary } from "./model";

const NOW = Date.parse("2026-10-06T21:00:00Z");

describe("formatUptime", () => {
  it("follows the GTK format_uptime rules with a 60s floor", () => {
    expect(formatUptime(5)).toBe("1m");
    expect(formatUptime(59 * 60)).toBe("59m");
    expect(formatUptime(2 * 3600)).toBe("2h");
    expect(formatUptime(2 * 3600 - 60)).toBe("1h 59m");
    expect(formatUptime(86400 * 3)).toBe("3d");
    expect(formatUptime(86400 + 3600 * 5)).toBe("1d 5h");
  });

  it("capitalizes plans", () => {
    expect(capitalizePlan("max")).toBe("Max");
    expect(capitalizePlan("team_premium")).toBe("Team premium");
  });
});

describe("settingsSummary", () => {
  it("lists files and non-zero counts", () => {
    expect(
      settingsSummary({
        settingsJson: true,
        claudeMd: true,
        skills: 2,
        agents: 1,
        commands: 0,
        outputStyles: 0,
      }),
    ).toBe("settings.json · CLAUDE.md · 2 skill files · 1 agent file");
    expect(
      settingsSummary({
        settingsJson: false,
        claudeMd: false,
        skills: 0,
        agents: 0,
        commands: 0,
        outputStyles: 0,
      }),
    ).toBe(CLAUDE_LABELS.noSettings);
  });
});

describe("claudeView", () => {
  it("is empty before the first check", () => {
    expect(claudeView(null, false, NOW)).toEqual({
      notice: null,
      account: null,
      more: null,
      signedIn: false,
    });
  });

  it("shows the signed-in account and the extra accounts caption", () => {
    const view = claudeView(
      [claudeAccount({ expiresAt: NOW + 2 * 3600_000 - 60_000 }), claudeAccount({ id: "claude-work", primary: false })],
      false,
      NOW,
    );
    expect(view.signedIn).toBe(true);
    expect(view.notice).toMatchObject({
      tone: "success",
      message: "Signed in as you@example.com",
    });
    expect(view.more).toBe("1 more account");
    expect(view.account?.properties.map((property) => property.value)).toEqual([
      "Signed in",
      "you@example.com · Example Org",
      "Max",
      "Expires in 1h 59m",
      "settings.json · CLAUDE.md · 2 skill files",
    ]);
  });

  it("reports expired tokens", () => {
    const view = claudeView([claudeAccount({ expiresAt: NOW - 3 * 3600_000 })], false, NOW);
    expect(view.account?.properties[3]?.value).toBe("Expired 3h ago · Claude Code refreshes it on next use");
  });

  it("asks to sign in with a command when the login is missing", () => {
    const view = claudeView([claudeAccount({ login: "missing", email: null, organization: null })], false, NOW);
    expect(view.notice).toMatchObject({
      tone: "warning",
      title: CLAUDE_LABELS.notSignedInTitle,
      command: "claude",
      action: "check",
    });
    expect(view.account?.properties[1]?.value).toBe("—");
    expect(view.account?.properties[3]?.value).toBe("—");
  });

  it("explains the macOS keychain", () => {
    const view = claudeView([claudeAccount({ login: "keychain" })], false, NOW);
    expect(view.notice).toMatchObject({
      tone: "info",
      title: CLAUDE_LABELS.keychainTitle,
    });
  });

  it("shows the install guide when ~/.claude was missing", () => {
    expect(claudeView([], true, NOW).notice).toMatchObject({
      title: CLAUDE_LABELS.folderMissingTitle,
      action: "install-guide",
    });
    expect(claudeView([claudeAccount({ login: "missing" })], true, NOW).notice?.title).toBe(
      CLAUDE_LABELS.folderMissingTitle,
    );
  });
});

describe("folder tracking", () => {
  it("remembers a missing folder until a login appears", () => {
    expect(isFolderMissing([])).toBe(true);
    expect(isFolderMissing(null)).toBe(false);
    expect(nextFolderMissing(false, [])).toBe(true);
    expect(nextFolderMissing(true, [claudeAccount({ login: "missing" })])).toBe(true);
    expect(nextFolderMissing(true, [claudeAccount()])).toBe(false);
    expect(nextFolderMissing(false, [claudeAccount({ login: "missing" })])).toBe(false);
  });
});
