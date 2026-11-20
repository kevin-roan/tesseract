import type { AccountDevice } from "@tesseract/protocol";
import type { AccountState } from "../../../../shared/contracts/account";
import type { PropertyListItem } from "../shared/PropertyList";
import { joinMeta } from "../shared/format";
import { ACCOUNT_LABELS as L } from "./labels";

export function formatWhen(iso: string | null, locale?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export function accountRows(state: AccountState, locale?: string): PropertyListItem[] {
  const account = state.account;
  if (!account) return [];
  return [
    { key: L.account.email, value: account.email ?? "—" },
    ...(account.displayName ? [{ key: L.account.name, value: account.displayName }] : []),
    { key: L.account.server, value: state.serverUrl ?? "—" },
    { key: L.account.expires, value: state.persisted ? (formatWhen(state.expiresAt, locale) ?? "—") : L.account.notPersisted },
  ];
}

export function deviceName(device: AccountDevice): string {
  return device.dnsName?.replace(/\.$/, "") || device.hostname;
}

export function deviceSubtitle(device: AccountDevice, locale?: string): string {
  const kind = device.kind ? L.devices.kinds[device.kind] : L.devices.unknownKind;
  const seen = device.online ? L.devices.online : joinMeta(L.devices.offline, device.lastSeen ? L.devices.lastSeen(formatWhen(device.lastSeen, locale) ?? "") : null);
  return joinMeta(kind, seen, device.ips[0]);
}
