import { useMemo } from "react";
import { View } from "react-native";
import { ArrowSquareOutIcon, ExportIcon, GlobeXIcon, WarningIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import EmptyState from "@/components/empty-state";
import GlassSheet from "@/components/glass-sheet";
import Notice from "@/components/notice";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useBrowserSheet } from "../../hooks/use-browser-sheet";
import { BROWSER_COPY, tabTitle } from "../../utils/browser";
import BrowserTabRow from "../browser-tab-row";
import createStyles from "./styles";

export type BrowserSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const BrowserSheet = ({ visible, onClose }: BrowserSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const browser = useBrowserSheet(visible);
  const { summary } = browser;

  return (
    <GlassSheet visible={visible} onClose={onClose} title={BROWSER_COPY.title} subtitle={BROWSER_COPY.subtitle}>
      {browser.error && !summary ? (
        <EmptyState
          icon={WarningIcon}
          title={BROWSER_COPY.errorTitle}
          message={browser.error}
          actionLabel="Try again"
          onAction={browser.refresh}
        />
      ) : !summary ? (
        <EmptyState loading title={BROWSER_COPY.loading} />
      ) : summary.kind === "unavailable" ? (
        <EmptyState
          icon={GlobeXIcon}
          loading={browser.refreshing}
          title={BROWSER_COPY.unavailableTitle}
          message={BROWSER_COPY.unavailableMessage}
          actionLabel="Try again"
          onAction={browser.refresh}
        />
      ) : summary.kind === "empty" ? (
        <EmptyState
          icon={GlobeXIcon}
          loading={browser.refreshing}
          title={BROWSER_COPY.emptyTitle}
          message={BROWSER_COPY.emptyMessage}
          actionLabel="Refresh"
          onAction={browser.refresh}
        />
      ) : (
        <>
          <View style={styles.current}>
            <ThemedText variant="bodyStrong" numberOfLines={2}>
              {tabTitle(summary.current)}
            </ThemedText>
            <View style={styles.field}>
              <ThemedText variant="overline" color="textTertiary">
                In the sandbox
              </ThemedText>
              <ThemedText variant="code" color="textSecondary" selectable>
                {summary.current.url}
              </ThemedText>
            </View>
            {summary.current.phoneUrl ? (
              <View style={styles.field}>
                <ThemedText variant="overline" color="textTertiary">
                  On your phone
                </ThemedText>
                <ThemedText variant="code" selectable>
                  {summary.current.phoneUrl}
                </ThemedText>
              </View>
            ) : (
              <Notice tone="warning" icon={WarningIcon} message={BROWSER_COPY.noPhoneUrl} />
            )}
          </View>
          <View style={styles.actions}>
            <ActionButton
              label="Open"
              icon={ArrowSquareOutIcon}
              disabled={!summary.current.phoneUrl}
              onPress={() => browser.open(summary.current)}
            />
            <ActionButton
              label="Share"
              icon={ExportIcon}
              variant="secondary"
              disabled={!summary.current.phoneUrl}
              onPress={() => browser.share(summary.current)}
            />
          </View>
          {browser.openError ? <Notice tone="danger" message={browser.openError} /> : null}
          {summary.others.length > 0 ? (
            <View style={styles.others}>
              <ThemedText variant="overline" color="textTertiary">
                Other tabs
              </ThemedText>
              {summary.others.map((tab) => (
                <BrowserTabRow key={tab.id} tab={tab} onOpen={browser.open} onShare={browser.share} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </GlassSheet>
  );
};

export default BrowserSheet;
