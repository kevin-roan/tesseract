import type { KeyValueItem } from "@/components/key-value-list";

import { ABOUT_COPY, UPDATE_PROMPT_HIDDEN_ROUTES } from "./constants";

export type AboutInfo = {
  version: string | null;
  build: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  createdAt: Date | null;
  isEmbeddedLaunch: boolean;
  platform: string;
  isDev: boolean;
};

export type UpdateStatus = {
  enabled: boolean;
  checking: boolean;
  downloading: boolean;
  pending: boolean;
  checkedAt: Date | null;
  checkError: string | null;
  downloadError: string | null;
};

export function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function channelLabel(channel: string | null): string {
  return channel || ABOUT_COPY.noChannel;
}

export function appRows(info: AboutInfo): KeyValueItem[] {
  return [
    { id: "version", label: ABOUT_COPY.version, value: info.version ?? ABOUT_COPY.unknown },
    { id: "build", label: ABOUT_COPY.build, value: info.build ?? ABOUT_COPY.unknown },
    { id: "platform", label: ABOUT_COPY.platform, value: info.platform },
    {
      id: "environment",
      label: ABOUT_COPY.environment,
      value: info.isDev ? ABOUT_COPY.devEnvironment : ABOUT_COPY.releaseEnvironment,
    },
  ];
}

export function updateRows(info: AboutInfo): KeyValueItem[] {
  const rows: KeyValueItem[] = [
    { id: "channel", label: ABOUT_COPY.channel, value: channelLabel(info.channel) },
    { id: "runtime", label: ABOUT_COPY.runtime, value: info.runtimeVersion ?? ABOUT_COPY.unknown, monospace: true },
    {
      id: "launch",
      label: ABOUT_COPY.launch,
      value: info.isEmbeddedLaunch ? ABOUT_COPY.embedded : ABOUT_COPY.downloaded,
    },
  ];
  if (info.updateId) rows.push({ id: "update", label: ABOUT_COPY.update, value: info.updateId, monospace: true });
  if (info.createdAt) rows.push({ id: "published", label: ABOUT_COPY.published, value: formatTimestamp(info.createdAt) });
  return rows;
}

export function updateStatusText(status: UpdateStatus): string {
  if (status.checking) return ABOUT_COPY.checking;
  if (status.downloading) return ABOUT_COPY.downloading;
  if (status.pending) return ABOUT_COPY.pending;
  if (status.checkError || status.downloadError) return ABOUT_COPY.noCheck;
  if (status.checkedAt) return `${ABOUT_COPY.upToDate} ${ABOUT_COPY.lastChecked(formatTimestamp(status.checkedAt))}.`;
  return ABOUT_COPY.noCheck;
}

export function showsUpdatePrompt(pathname: string): boolean {
  return !UPDATE_PROMPT_HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
