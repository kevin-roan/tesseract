import type { BrowserStatus, BrowserTab } from "@theone/protocol";

export type BrowserSummary =
  | { kind: "unavailable" }
  | { kind: "empty" }
  | { kind: "tabs"; current: BrowserTab; others: BrowserTab[] };

export type TabShare = { title: string; message: string; url: string };

export const BROWSER_COPY = {
  title: "Sandbox browser",
  subtitle: "The page open in Chromium on the sandbox display.",
  unavailableTitle: "Can't read Chromium's tabs",
  unavailableMessage:
    "Chromium on the sandbox isn't exposing its remote debugging port, so the controller can't see which page is open. Start Chromium from the sandbox (it launches with --remote-debugging-port), then try again.",
  emptyTitle: "No pages open",
  emptyMessage: "Chromium is running but has no tabs open.",
  noPhoneUrl:
    "This page is served on the sandbox's localhost, and the sandbox has no Tailscale address to rewrite it to, so your phone can't reach it. Connect the sandbox to your tailnet and try again.",
  errorTitle: "Couldn't read the browser",
  loading: "Reading Chromium's tabs…",
} as const;

export function browserSummary(status: BrowserStatus): BrowserSummary {
  if (!status.available) return { kind: "unavailable" };
  const [current, ...others] = status.tabs;
  return current ? { kind: "tabs", current, others } : { kind: "empty" };
}

export function tabTitle(tab: BrowserTab): string {
  return tab.title.trim() || tab.url;
}

export function tabShare(tab: BrowserTab): TabShare | null {
  if (!tab.phoneUrl) return null;
  const title = tabTitle(tab);
  return { title, url: tab.phoneUrl, message: title === tab.phoneUrl ? tab.phoneUrl : `${title}\n${tab.phoneUrl}` };
}
