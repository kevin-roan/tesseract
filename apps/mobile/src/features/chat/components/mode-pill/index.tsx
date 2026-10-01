import { useMemo } from "react";
import { Pressable } from "react-native";
import { CaretDownIcon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type ModePillProps = {
  label: string;
  detail?: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

const ModePill = ({ label, detail, onPress, disabled = false, accessibilityHint, testID }: ModePillProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={detail ? { text: detail } : undefined}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={HitSlop.sm}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed, disabled && styles.disabled]}
      testID={testID}
    >
      <ThemedText variant="label" numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.text}>
        {label}
        {detail ? (
          <ThemedText variant="label" color="textSecondary">
            {` ${detail}`}
          </ThemedText>
        ) : null}
      </ThemedText>
      <CaretDownIcon size={IconSize.xs} color={theme.colors.textSecondary} weight="bold" />
    </Pressable>
  );
};

export default ModePill;
