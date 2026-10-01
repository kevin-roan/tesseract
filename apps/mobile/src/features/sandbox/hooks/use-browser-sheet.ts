import { useCallback } from "react";
import { Platform, Share } from "react-native";
import type { BrowserTab } from "@theone/protocol";

import { browserSummary, tabShare } from "../utils/browser";
import { describeError } from "../utils/errors";
import { useOpenSite } from "./use-open-site";
import { useDisplayBrowser } from "./use-sandbox-queries";

/** Chromium's tabs on the sandbox display, fetched while the sheet is open, with open/share for the phone. */
export function useBrowserSheet(visible: boolean) {
  const query = useDisplayBrowser(visible);
  const site = useOpenSite();
  const { refetch } = query;
  const { open: openUrl } = site;

  const refresh = useCallback(() => void refetch(), [refetch]);

  const open = useCallback((tab: BrowserTab) => {
    if (tab.phoneUrl) openUrl(tab.phoneUrl);
  }, [openUrl]);

  const share = useCallback((tab: BrowserTab) => {
    const content = tabShare(tab);
    if (!content) return;
    const payload = Platform.OS === "ios" ? { url: content.url, message: content.title } : { title: content.title, message: content.message };
    Share.share(payload, { dialogTitle: content.title }).catch(() => undefined);
  }, []);

  return {
    summary: query.data ? browserSummary(query.data) : null,
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error ? describeError(query.error) : null,
    openError: site.error,
    refresh,
    open,
    share,
  };
}
