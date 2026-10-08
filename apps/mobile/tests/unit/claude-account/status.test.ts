import type { ClaudeAuthStatus } from "@tesseract/protocol";
import { sampleClaudeAuthStatus } from "@tesseract/protocol/fixtures";

import { claudeAccountSummary, claudeMethodLabel, claudeStatusView } from "@/features/claude-account/utils/status";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");

const status = (overrides: Partial<ClaudeAuthStatus> = {}): ClaudeAuthStatus => ({
  ...sampleClaudeAuthStatus,
  ...overrides,
});

const signedOut = status({
  method: "none",
  loggedIn: false,
  sources: { oauthToken: false, credentials: false, apiKey: false },
  account: null,
  subscriptionType: null,
  importedAt: null,
});

const rowValue = (view: ReturnType<typeof claudeStatusView>, id: string) =>
  view.rows.find((row) => row.id === id)?.value;

describe("claudeMethodLabel", () => {
  it.each([
    ["oauth_token", "OAuth token"],
    ["credentials", "Host login"],
    ["api_key", "API key"],
    ["none", "None"],
  ] as const)("labels %s", (method, label) => {
    expect(claudeMethodLabel(method)).toBe(label);
  });
});

describe("claudeAccountSummary", () => {
  it("prefers the account email", () => {
    expect(claudeAccountSummary(sampleClaudeAuthStatus)).toBe("dev@example.com");
  });

  it("falls back to the method when no account is known", () => {
    expect(claudeAccountSummary(status({ account: null, method: "api_key" }))).toBe("API key");
  });

  it("covers loading, signed out and missing Claude Code", () => {
    expect(claudeAccountSummary(undefined)).toBe("Checking…");
    expect(claudeAccountSummary(signedOut)).toBe("Not signed in");
    expect(claudeAccountSummary(status({ available: false }))).toBe("Claude Code not installed");
  });
});

describe("claudeStatusView", () => {
  it("describes a token sign-in with account details", () => {
    const view = claudeStatusView(sampleClaudeAuthStatus, NOW);
    expect(view).toMatchObject({
      title: "Dev",
      subtitle: "dev@example.com",
      badge: { label: "Signed in", tone: "success" },
    });
    expect(rowValue(view, "method")).toBe("OAuth token");
    expect(rowValue(view, "email")).toBe("dev@example.com");
    expect(rowValue(view, "org")).toBe("Example");
    expect(rowValue(view, "plan")).toBe("Max");
    expect(rowValue(view, "imported")).toBe("2026-01-01");
    expect(rowValue(view, "expires")).toBeUndefined();
  });

  it("shows the expiry of a host login", () => {
    const later = claudeStatusView(
      status({ method: "credentials", credentialsExpiresAt: "2026-09-24T08:30:00.000Z" }),
      NOW,
    );
    expect(rowValue(later, "method")).toBe("Host login");
    expect(rowValue(later, "expires")).toBe("2026-09-24 08:30 UTC");

    const past = claudeStatusView(status({ method: "credentials", credentialsExpiresAt: "2026-09-23T10:00:00.000Z" }), NOW);
    expect(rowValue(past, "expires")).toBe("Expired 2h ago");
  });

  it("explains a signed-out sandbox", () => {
    const view = claudeStatusView(signedOut, NOW);
    expect(view).toMatchObject({ title: "Not signed in", badge: { label: "Signed out", tone: "warning" } });
    expect(view.subtitle).toMatch(/~\/\.claude/);
    expect(rowValue(view, "method")).toBeUndefined();
    expect(rowValue(view, "imported")).toBe("Never");
  });

  it("flags a missing Claude Code install and an environment token", () => {
    const view = claudeStatusView(status({ available: false, oauthTokenFromEnv: true }), NOW);
    expect(view).toMatchObject({ title: "Claude Code not installed", badge: { tone: "danger" } });
    expect(rowValue(view, "env")).toBe("Sandbox environment");
  });
});
