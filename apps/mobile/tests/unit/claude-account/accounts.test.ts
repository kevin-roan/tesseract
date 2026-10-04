import type { ClaudeAccountList } from "@theone/protocol";
import { sampleClaudeAccountList } from "@theone/protocol/fixtures";

import {
  DEFAULT_ACCOUNT_CHOICE,
  accountIdForChoice,
  claudeAccountDetail,
  claudeAccountRows,
  claudeAccountsSummary,
  projectAccountChoice,
  projectAccountOptions,
  projectAccountSummary,
} from "@/features/claude-account/utils/accounts";

const [primary, work] = sampleClaudeAccountList.accounts;

const withPersonal: ClaudeAccountList = {
  ...sampleClaudeAccountList,
  accounts: [
    ...sampleClaudeAccountList.accounts,
    { ...work, id: "claude-personal", present: false, loggedIn: false, account: null, subscriptionType: null },
  ],
};

describe("claudeAccountDetail", () => {
  it("describes signed-in, signed-out and missing accounts", () => {
    expect(claudeAccountDetail(primary)).toBe("dev@example.com · Example · Max");
    expect(claudeAccountDetail({ ...work, loggedIn: false })).toBe("Not signed in");
    expect(claudeAccountDetail({ ...work, present: false })).toBe("Not linked into the sandbox");
  });
});

describe("claudeAccountRows", () => {
  it("marks the default account", () => {
    const rows = claudeAccountRows(withPersonal, null);
    expect(rows.map((row) => [row.id, row.selected, row.value, row.disabled])).toEqual([
      ["claude", true, "Default", false],
      ["claude-work", false, undefined, false],
      ["claude-personal", false, undefined, true],
    ]);
  });

  it("selects the pending account optimistically", () => {
    const rows = claudeAccountRows(sampleClaudeAccountList, "claude-work");
    expect(rows.find((row) => row.selected)?.id).toBe("claude-work");
    expect(rows[1].value).toBe("Switching…");
  });
});

describe("claudeAccountsSummary", () => {
  it("names the default account and hints at switching", () => {
    expect(claudeAccountsSummary(sampleClaudeAccountList)).toBe("dev@example.com · Switch accounts (2 accounts)");
    expect(claudeAccountsSummary({ ...sampleClaudeAccountList, accounts: [primary] })).toBe("dev@example.com");
  });
});

describe("project account choice", () => {
  it("maps the default option to null", () => {
    expect(projectAccountChoice(null)).toBe(DEFAULT_ACCOUNT_CHOICE);
    expect(projectAccountChoice("claude-work")).toBe("claude-work");
    expect(accountIdForChoice(DEFAULT_ACCOUNT_CHOICE)).toBeNull();
    expect(accountIdForChoice("claude-work")).toBe("claude-work");
  });

  it("offers the default first, then every account", () => {
    const options = projectAccountOptions(sampleClaudeAccountList);
    expect(options.map((option) => option.label)).toEqual(["Default (claude)", "claude", "claude-work"]);
  });

  it("summarises the effective account", () => {
    expect(projectAccountSummary(null, sampleClaudeAccountList)).toBe("Default (claude) · dev@example.com · Example · Max");
    expect(projectAccountSummary("claude-work", sampleClaudeAccountList)).toBe("claude-work · dev@work.example · Work · Team");
    expect(projectAccountSummary(null, undefined)).toBe("Default");
  });
});
