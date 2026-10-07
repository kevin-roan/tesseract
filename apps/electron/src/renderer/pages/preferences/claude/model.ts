import type { ClaudeAccountList, ClaudeAccountProfile, ClaudeAuthStatus } from "@theone/protocol";
import type { HostClaudeSettings, HostClaudeState } from "../../../../shared/contracts/claude";
import type { RadioChoice } from "../../../components/RadioRows";
import type { PropertyListItem } from "../shared/PropertyList";
import { capitalize, formatUptime, joinMeta, pluralize } from "../shared/format";
import { SHARED_LABELS } from "../shared/labels";
import { LOGIN_LABELS, METHOD_LABELS, METHOD_OAUTH_ENV, SECTION_LABELS } from "./labels";

export type PropertyItem = PropertyListItem;

const MIN_EXPIRY_SECONDS = 60;
const EXTENSION_KEYS = ["skills", "agents", "commands", "outputStyles"] as const satisfies readonly (keyof HostClaudeSettings)[];

export function planLabel(value: string | null | undefined): string {
  return value ? capitalize(value) : SHARED_LABELS.none;
}

export function accountLabel(email: string | null | undefined, organization: string | null | undefined): string {
  return joinMeta(email, organization) || SHARED_LABELS.none;
}

export function formatExpiry(expiresAtMs: number | null, nowMs: number): string {
  if (expiresAtMs === null) return SHARED_LABELS.none;
  const delta = (expiresAtMs - nowMs) / 1000;
  if (delta >= 0) return SECTION_LABELS.expiresIn(formatUptime(Math.max(MIN_EXPIRY_SECONDS, delta)));
  return SECTION_LABELS.expired(formatUptime(Math.max(MIN_EXPIRY_SECONDS, -delta)));
}

function isoExpiry(value: string | null, nowMs: number): string {
  if (!value) return SHARED_LABELS.none;
  const parsed = Date.parse(value);
  return formatExpiry(Number.isNaN(parsed) ? null : parsed, nowMs);
}

export function settingsSummary(settings: HostClaudeSettings): string {
  const parts: (string | null)[] = [settings.settingsJson ? SECTION_LABELS.settingsJson : null, settings.claudeMd ? SECTION_LABELS.claudeMd : null];
  for (const key of EXTENSION_KEYS) if (settings[key]) parts.push(pluralize(settings[key], SECTION_LABELS[key]));
  return joinMeta(...parts) || SECTION_LABELS.settingsNone;
}

export function hostAccountSubtitle(state: HostClaudeState): string {
  return joinMeta(state.email, state.configDir);
}

export function hostAccountRows(state: HostClaudeState, nowMs: number): PropertyItem[] {
  const signedIn = state.login === "signed-in";
  return [
    { key: SECTION_LABELS.login, value: LOGIN_LABELS[state.login] },
    { key: SECTION_LABELS.account, value: accountLabel(state.email, state.organization) },
    { key: SECTION_LABELS.plan, value: planLabel(state.subscriptionType) },
    { key: SECTION_LABELS.tokenExpiry, value: signedIn ? formatExpiry(state.expiresAt, nowMs) : SHARED_LABELS.none },
    { key: SECTION_LABELS.settings, value: settingsSummary(state.settings) },
  ];
}

export function methodLabel(status: ClaudeAuthStatus): string {
  if (!status.available) return SECTION_LABELS.unavailable;
  if (status.method === "oauth_token" && status.oauthTokenFromEnv) return METHOD_OAUTH_ENV;
  return METHOD_LABELS[status.method];
}

export function sandboxAuthRows(status: ClaudeAuthStatus, nowMs: number): PropertyItem[] {
  return [
    { key: SHARED_LABELS.status, value: methodLabel(status) },
    { key: SECTION_LABELS.account, value: accountLabel(status.account?.email, status.account?.organization) },
    { key: SECTION_LABELS.plan, value: planLabel(status.subscriptionType) },
    { key: SECTION_LABELS.tokenExpiry, value: status.method === "credentials" ? isoExpiry(status.credentialsExpiresAt, nowMs) : SHARED_LABELS.none },
    { key: SECTION_LABELS.settings, value: status.settingsPresent ? SECTION_LABELS.settingsPresent : SECTION_LABELS.settingsMissing },
  ];
}

export function profileLoginLabel(profile: ClaudeAccountProfile, nowMs: number): string {
  if (!profile.present) return SECTION_LABELS.accountAbsent;
  if (!profile.loggedIn) return SECTION_LABELS.notLoggedIn;
  return joinMeta(SECTION_LABELS.loggedIn, profile.credentialsExpiresAt ? isoExpiry(profile.credentialsExpiresAt, nowMs) : null);
}

export function accountChoices(list: ClaudeAccountList | undefined, nowMs: number): RadioChoice[] {
  if (!list) return [];
  return list.accounts.map((profile) => ({
    id: profile.id,
    title: joinMeta(profile.id, profile.primary ? SECTION_LABELS.primary : null),
    subtitle: [
      accountLabel(profile.account?.email, profile.account?.organization),
      joinMeta(planLabel(profile.subscriptionType), profileLoginLabel(profile, nowMs)),
      profile.configDir,
    ]
      .filter(Boolean)
      .join("\n"),
    available: profile.present,
  }));
}

export function sandboxDescription(configDir: string | undefined): string {
  return configDir ? joinMeta(SECTION_LABELS.sandboxDescription, configDir) : SECTION_LABELS.sandboxDescription;
}
