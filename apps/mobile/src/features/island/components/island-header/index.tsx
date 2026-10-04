import { useMemo } from "react";
import { View } from "react-native";
import { CaretUpIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import type { Tone } from "@/lib/tone";
import { HitSlop, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type IslandHeaderProps = {
  name: string;
  status: string;
  tone: Tone;
  onCollapse: () => void;
};

const IslandHeader = ({ name, status, tone, onCollapse }: IslandHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const collapse = useHapticPress(onCollapse);

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <ThemedText
          variant="h4"
          numberOfLines={1}
          maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
          style={styles.name}
        >
          {name}
        </ThemedText>
        <TagChip label={status} tone={tone} dot />
      </View>
      <PressableScale
        depth="control"
        accessibilityRole="button"
        accessibilityLabel="Collapse"
        hitSlop={HitSlop.md}
        onPress={collapse}
        style={styles.collapse}
      >
        <CaretUpIcon size={IconSize.sm} color={theme.colors.textSecondary} weight="regular" />
      </PressableScale>
    </View>
  );
};

export default IslandHeader;
