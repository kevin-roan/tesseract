import { useMemo } from "react";
import {
  View,
  type AccessibilityRole,
  type AccessibilityValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CaretDownIcon, type Icon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";
import { HitSlop, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles, { type TagChipSize } from "./styles";

export type TagChipProps = {
  label: string;
  tone?: Tone;
  dot?: boolean;
  icon?: Icon;
  caret?: boolean;
  size?: TagChipSize;
  /** Label and icon take the tone color instead of the quiet grey. */
  tinted?: boolean;
  onPress?: () => void;
  /** A static chip with any of these becomes one accessibility element. */
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityValue?: AccessibilityValue;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TagChip = ({
  label,
  tone = "neutral",
  dot = false,
  icon: IconComponent,
  caret = false,
  size = "sm",
  tinted = false,
  onPress,
  accessibilityLabel,
  accessibilityRole,
  accessibilityValue,
  style,
  testID,
}: TagChipProps) => {
  const theme = useAppTheme();
  const pressable = onPress !== undefined;
  const styles = useMemo(() => createStyles(theme, size, pressable), [theme, size, pressable]);
  const { foreground } = ToneColors[tone];
  const labelColor = tinted ? foreground : pressable ? "text" : "textSecondary";
  const iconColor = tinted ? foreground : "text";

  const content = (
    <>
      {dot ? <View style={[styles.dot, { backgroundColor: theme.colors[foreground] }]} /> : null}
      {IconComponent ? <IconComponent size={IconSize.xs} color={theme.colors[iconColor]} weight="regular" /> : null}
      <ThemedText
        variant={size === "md" ? "label" : "caption"}
        color={labelColor}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
        style={styles.label}
      >
        {label}
      </ThemedText>
      {caret ? <CaretDownIcon size={IconSize.xs} color={theme.colors.textSecondary} weight="regular" /> : null}
    </>
  );

  if (!onPress) {
    const described =
      accessibilityLabel !== undefined || accessibilityRole !== undefined || accessibilityValue !== undefined;
    return (
      <View
        style={[styles.chip, style]}
        testID={testID}
        accessible={described || undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityValue={accessibilityValue}
      >
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      depth="control"
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityValue={accessibilityValue}
      hitSlop={HitSlop.md}
      onPress={onPress}
      testID={testID}
      style={[styles.chip, styles.pressable, style]}
    >
      {content}
    </PressableScale>
  );
};

export default TagChip;
