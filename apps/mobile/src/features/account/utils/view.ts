import { CubeIcon, DesktopIcon, DeviceMobileIcon, HardDrivesIcon, QuestionIcon, type Icon } from "phosphor-react-native";
import type { Account, AccountDevice, AccountDeviceKind, TailnetStatus } from "@tesseract/protocol";

import type { KeyValueItem } from "@/components/key-value-list";
import { formatRelativeTime } from "@/features/sandbox/utils/format";

import { ACCOUNT_COPY, DEVICE_COPY, DEVICE_KIND_LABELS, PROVIDER_LABELS, TAILNET_STATE_VIEW } from "./content";

export function accountLabel(account: Account): string {
  return account.email ?? account.displayName ?? PROVIDER_LABELS[account.provider];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function accountRows(account: Account): KeyValueItem[] {
  const rows: KeyValueItem[] = [];
  if (account.email) rows.push({ id: "email", label: ACCOUNT_COPY.emailLabel, value: account.email });
  if (account.displayName) rows.push({ id: "name", label: ACCOUNT_COPY.nameLabel, value: account.displayName });
  rows.push(
    { id: "provider", label: ACCOUNT_COPY.providerLabel, value: PROVIDER_LABELS[account.provider] },
    { id: "since", label: ACCOUNT_COPY.memberSinceLabel, value: formatDate(account.createdAt) },
  );
  return rows;
}

export function tailnetStateView(status: TailnetStatus | null) {
  return TAILNET_STATE_VIEW[status?.state ?? "unavailable"];
}

export function tailnetRows(status: TailnetStatus | null): KeyValueItem[] {
  const state = tailnetStateView(status);
  const rows: KeyValueItem[] = [{ id: "status", label: ACCOUNT_COPY.statusLabel, value: state.label, tone: state.tone }];
  if (!status || status.state !== "running") return rows;
  const name = status.dnsName ?? status.hostName;
  if (name) rows.push({ id: "device", label: ACCOUNT_COPY.deviceLabel, value: name.replace(/\.$/, ""), monospace: true });
  if (status.ips[0]) rows.push({ id: "address", label: ACCOUNT_COPY.addressLabel, value: status.ips[0], monospace: true });
  rows.push({
    id: "peers",
    label: ACCOUNT_COPY.peersLabel,
    value: String(status.peers.filter((peer) => peer.online).length),
  });
  return rows;
}

export function needsReconnect(status: TailnetStatus | null): boolean {
  return !status || status.state === "stopped" || status.state === "needs_login" || status.state === "error";
}

const DEVICE_ICONS: Record<AccountDeviceKind, Icon> = {
  mobile: DeviceMobileIcon,
  desktop: DesktopIcon,
  sandbox: CubeIcon,
  server: HardDrivesIcon,
};

export type DeviceRow = { id: string; hostname: string; label: string; detail: string; icon: Icon };

export function deviceDetail(device: AccountDevice, now: number = Date.now()): string {
  const parts = [device.kind ? DEVICE_KIND_LABELS[device.kind] : null];
  if (device.online) parts.push(DEVICE_COPY.online);
  else parts.push(device.lastSeen ? DEVICE_COPY.lastSeen(formatRelativeTime(device.lastSeen, now)) : DEVICE_COPY.offline);
  return parts.filter(Boolean).join(DEVICE_COPY.separator);
}

export function deviceRows(devices: readonly AccountDevice[], now: number = Date.now()): DeviceRow[] {
  return [...devices]
    .sort((a, b) => Number(b.online) - Number(a.online) || a.hostname.localeCompare(b.hostname))
    .map((device) => ({
      id: device.id,
      hostname: device.hostname,
      label: device.hostname,
      detail: deviceDetail(device, now),
      icon: device.kind ? DEVICE_ICONS[device.kind] : QuestionIcon,
    }));
}
