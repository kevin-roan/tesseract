import { useMemo } from "react";
import { View } from "react-native";
import { ArrowSquareOutIcon, ExportIcon } from "phosphor-react-native";
import type { BrowserTab } from "@tesseract/protocol";

import IconButton from "@/components/icon-button";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { tabTitle } from "../../utils/browser";
import createStyles from "./styles";

export type BrowserTabRowProps = {
  tab: BrowserTab;
  onOpen: (tab: BrowserTab) => void;
  onShare: (tab: BrowserTab) => void;
};

const BrowserTabRow = ({ tab, onOpen, onShare }: BrowserTabRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const title = tabTitle(tab);
  const reachable = tab.phoneUrl !== null;

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <ThemedText variant="body" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
          {tab.phoneUrl ?? tab.url}
        </ThemedText>
      </View>
      <IconButton icon={ArrowSquareOutIcon} label={`Open ${title}`} disabled={!reachable} onPress={() => onOpen(tab)} />
      <IconButton icon={ExportIcon} label={`Share ${title}`} disabled={!reachable} onPress={() => onShare(tab)} />
    </View>
  );
};

export default BrowserTabRow;
