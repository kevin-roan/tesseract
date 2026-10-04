import { useMemo } from "react";
import { View } from "react-native";
import { ArrowSquareOutIcon, ExportIcon, GlobeXIcon, WarningIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import EmptyState from "@/components/empty-state";
import GlassSheet from "@/components/glass-sheet";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import { Surface } from "@/components/surface";
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
          <MotionItem index={0}>
            <Surface>
              <ThemedText variant="bodyLarge" numberOfLines={2} style={styles.title}>
                {tabTitle(summary.current)}
              </ThemedText>
              <View style={styles.field}>
                <ThemedText variant="caption" color="textTertiary">
                  In the sandbox
                </ThemedText>
                <ThemedText variant="code" color="textSecondary" selectable>
                  {summary.current.url}
                </ThemedText>
              </View>
              {summary.current.phoneUrl ? (
                <View style={styles.field}>
                  <ThemedText variant="caption" color="textTertiary">
                    On your phone
                  </ThemedText>
                  <ThemedText variant="code" selectable>
                    {summary.current.phoneUrl}
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.notice}>
                  <Notice tone="warning" icon={WarningIcon} message={BROWSER_COPY.noPhoneUrl} />
                </View>
              )}
            </Surface>
          </MotionItem>
          <MotionItem index={1} style={styles.actions}>
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
          </MotionItem>
          {browser.openError ? (
            <MotionItem>
              <Notice tone="danger" message={browser.openError} />
            </MotionItem>
          ) : null}
          {summary.others.length > 0 ? (
            <MotionItem index={2}>
              <Surface>
                <ThemedText variant="caption" color="textTertiary" accessibilityRole="header" style={styles.othersTitle}>
                  Other tabs
                </ThemedText>
                {summary.others.map((tab) => (
                  <MotionItem key={tab.id}>
                    <BrowserTabRow tab={tab} onOpen={browser.open} onShare={browser.share} />
                  </MotionItem>
                ))}
              </Surface>
            </MotionItem>
          ) : null}
        </>
      )}
    </GlassSheet>
  );
};

export default BrowserSheet;
