import type { ClaudeAuthMethod, ClaudeAuthStatus } from "@tesseract/protocol";

import type { StatusBadgeProps } from "@/components/status-badge";
import { capitalize, formatRelativeTime } from "@/features/sandbox/utils/format";

export type ClaudeStatusRow = { id: string; label: string; value: string };

export type ClaudeStatusView = {
  title: string;
  subtitle?: string;
  badge: StatusBadgeProps;
  rows: ClaudeStatusRow[];
};

const METHOD_LABELS: Record<ClaudeAuthMethod, string> = {
  oauth_token: "OAuth token",
  credentials: "Host login",
  api_key: "API key",
  none: "None",
};

const NOT_SIGNED_IN = "Not signed in";

export const claudeMethodLabel = (method: ClaudeAuthMethod): string => METHOD_LABELS[method];

export function claudeAccountSummary(status: ClaudeAuthStatus | undefined): string {
  if (!status) return "Checking…";
  if (!status.available) return "Claude Code not installed";
  if (!status.loggedIn) return NOT_SIGNED_IN;
  return status.account?.email ?? status.account?.displayName ?? claudeMethodLabel(status.method);
}

function formatExpiry(iso: string, now: number): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return time <= now ? `Expired ${formatRelativeTime(iso, now)}` : `${new Date(time).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function claudeStatusView(status: ClaudeAuthStatus, now: number = Date.now()): ClaudeStatusView {
  const { account } = status;
  const rows: ClaudeStatusRow[] = [];

  if (status.loggedIn) rows.push({ id: "method", label: "Signed in with", value: claudeMethodLabel(status.method) });
  if (account?.email) rows.push({ id: "email", label: "Account", value: account.email });
  if (account?.organization) rows.push({ id: "org", label: "Organization", value: account.organization });
  if (status.subscriptionType) rows.push({ id: "plan", label: "Subscription", value: capitalize(status.subscriptionType) });
  if (status.method === "credentials" && status.credentialsExpiresAt) {
    rows.push({ id: "expires", label: "Login expires", value: formatExpiry(status.credentialsExpiresAt, now) });
  }
  if (status.oauthTokenFromEnv) rows.push({ id: "env", label: "Token source", value: "Sandbox environment" });
  rows.push({
    id: "imported",
    label: "Settings imported",
    value: status.importedAt ? formatRelativeTime(status.importedAt, now) || status.importedAt : "Never",
  });

  if (!status.available) {
    return {
      title: "Claude Code not installed",
      subtitle: "The sandbox has no claude executable.",
      badge: { label: "Unavailable", tone: "danger" },
      rows,
    };
  }
  if (!status.loggedIn) {
    return {
      title: NOT_SIGNED_IN,
      subtitle: "Sign in with claude on the host machine; its ~/.claude folder is linked into the sandbox.",
      badge: { label: "Signed out", tone: "warning" },
      rows,
    };
  }
  return {
    title: account?.displayName || account?.email || "Signed in",
    subtitle: account?.displayName && account.email ? account.email : undefined,
    badge: { label: "Signed in", tone: "success" },
    rows,
  };
}
