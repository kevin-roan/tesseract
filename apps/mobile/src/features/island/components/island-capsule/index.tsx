import { useMemo } from "react";
import { View } from "react-native";
import { CaretDownIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type IslandCapsuleProps = {
  title: string;
  badge: string | null;
  live?: boolean;
  onPress: () => void;
  testID?: string;
};

const IslandCapsule = ({ title, badge, live = false, onPress, testID }: IslandCapsuleProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(onPress);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={badge ? `${title}, ${badge}` : title}
      accessibilityHint="Shows running work and controls"
      onPress={press}
      testID={testID}
    >
      {({ pressed }) => (
        <Surface style={[styles.capsule, pressed && styles.pressed]}>
          <View style={styles.tile} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={[styles.dot, live && styles.dotLive]} />
          </View>
          <ThemedText variant="label" numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.title}>
            {title}
          </ThemedText>
          {badge ? <TagChip label={badge} /> : null}
          <CaretDownIcon size={IconSize.sm} color={theme.colors.textSecondary} weight="regular" />
        </Surface>
      )}
    </PressableScale>
  );
};

export default IslandCapsule;
