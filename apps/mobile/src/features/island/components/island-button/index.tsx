import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type IslandButtonProps = {
  icon: Icon;
  label: string;
  /** `primary` is the wide light pill that shows `label`; `round` is an icon-only circle. */
  variant?: "round" | "primary";
  /** Small count drawn on the round button's corner. */
  badge?: number;
  loading?: boolean;
  onPress: () => void;
  testID?: string;
};

/** Monochrome island control: an icon circle or the one light pill. */
const IslandButton = ({ icon: IconComponent, label, variant = "round", badge = 0, loading = false, onPress, testID }: IslandButtonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(onPress);
  const primary = variant === "primary";
  const ink = primary ? theme.colors.accentInk : theme.colors.text;

  return (
    <PressableScale
      depth="control"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={press}
      style={primary ? styles.primary : styles.round}
      pressedStyle={primary ? styles.primaryPressed : styles.roundPressed}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator size="small" color={ink} />
      ) : (
        <IconComponent size={IconSize.md} color={ink} weight={primary ? "bold" : "regular"} />
      )}
      {primary ? (
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
          {label}
        </Text>
      ) : null}
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
            {badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
};

export default IslandButton;
