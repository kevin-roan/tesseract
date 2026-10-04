import { useMemo } from "react";
import { View } from "react-native";
import { CheckIcon } from "phosphor-react-native";
import type { SyncFileChange } from "@theone/protocol";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors } from "@/lib/tone";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import { syncKindCode, syncKindTone } from "../../utils/sync";
import createStyles from "./styles";

export type SyncFileRowProps = {
  change: SyncFileChange;
  /** Shows a checkbox; the row toggles it through `onPress`. */
  selected?: boolean;
  onPress?: () => void;
};

const SyncFileRow = ({ change, selected, onPress }: SyncFileRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tone = ToneColors[syncKindTone(change.kind)];
  const selectable = selected !== undefined;

  const content = (
    <>
      <View style={[styles.code, { backgroundColor: theme.colors[tone.background] }]}>
        <ThemedText variant="code" color={tone.foreground} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
          {syncKindCode(change.kind)}
        </ThemedText>
      </View>
      <ThemedText variant="code" color="textSecondary" numberOfLines={1} ellipsizeMode="head" style={styles.path}>
        {change.path}
      </ThemedText>
      {selectable ? (
        <View
          style={[styles.check, selected && styles.checkOn]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {selected ? <CheckIcon size={IconSize.xs} color={theme.colors.accentInk} weight="bold" /> : null}
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${change.kind} ${change.path}`}>
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      style={styles.row}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={`${change.kind} ${change.path}`}
      accessibilityState={{ checked: selected ?? false }}
    >
      {content}
    </PressableScale>
  );
};

export default SyncFileRow;
