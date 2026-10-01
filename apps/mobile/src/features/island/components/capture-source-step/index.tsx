import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { ClipboardIcon, DeviceMobileIcon, ImagesIcon, MonitorIcon, type Icon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { IconSize } from "@/theme";

import type { CaptureOption, CaptureSource } from "../../types";
import createStyles from "./styles";

const ICONS: Record<CaptureSource, Icon> = {
  app: DeviceMobileIcon,
  screen: MonitorIcon,
  library: ImagesIcon,
  clipboard: ClipboardIcon,
};

type OptionRowProps = { option: CaptureOption; disabled: boolean; onSelect: (source: CaptureSource) => void };

const OptionRow = ({ option, disabled, onSelect }: OptionRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(() => onSelect(option.id));
  const IconComponent = ICONS[option.id];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityHint={option.description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
      testID={`capture-source-${option.id}`}
    >
      <View style={styles.icon}>
        <IconComponent size={IconSize.md} color={theme.colors.accentStrong} weight="bold" />
      </View>
      <View style={styles.copy}>
        <ThemedText variant="bodyStrong">{option.label}</ThemedText>
        <ThemedText variant="caption" color="textSecondary">
          {option.description}
        </ThemedText>
      </View>
    </Pressable>
  );
};

export type CaptureSourceStepProps = {
  options: CaptureOption[];
  disabled?: boolean;
  onSelect: (source: CaptureSource) => void;
};

const CaptureSourceStep = ({ options, disabled = false, onSelect }: CaptureSourceStepProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.list} accessibilityRole="menu">
      {options.map((option) => (
        <OptionRow key={option.id} option={option} disabled={disabled} onSelect={onSelect} />
      ))}
    </View>
  );
};

export default CaptureSourceStep;
