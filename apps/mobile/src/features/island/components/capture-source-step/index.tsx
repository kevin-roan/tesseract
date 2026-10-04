import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ClipboardIcon, DeviceMobileIcon, ImagesIcon, MonitorIcon, type Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import { ListGroup } from "@/components/list-group";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { ControlHeight, IconSize } from "@/theme";
import { useEntrance } from "@/hooks/use-entrance";

import type { CaptureOption, CaptureSource } from "../../types";
import createStyles from "./styles";

const ICONS: Record<CaptureSource, Icon> = {
  app: DeviceMobileIcon,
  screen: MonitorIcon,
  library: ImagesIcon,
  clipboard: ClipboardIcon,
};

type OptionRowProps = { option: CaptureOption; index: number; disabled: boolean; onSelect: (source: CaptureSource) => void };

const OptionRow = ({ option, index, disabled, onSelect }: OptionRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(() => onSelect(option.id));
  const entering = useEntrance(index, "tight");
  const IconComponent = ICONS[option.id];

  return (
    <Animated.View entering={entering}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={option.label}
        accessibilityHint={option.description}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={press}
        style={[styles.row, disabled && styles.disabled]}
        pressedStyle={styles.pressed}
        testID={`capture-source-${option.id}`}
      >
        <IconTile icon={IconComponent} size={ControlHeight.md} iconSize={IconSize.md} radius="md" />
        <View style={styles.copy}>
          <ThemedText variant="label">{option.label}</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {option.description}
          </ThemedText>
        </View>
      </PressableScale>
    </Animated.View>
  );
};

export type CaptureSourceStepProps = {
  options: CaptureOption[];
  disabled?: boolean;
  onSelect: (source: CaptureSource) => void;
};

const CaptureSourceStep = ({ options, disabled = false, onSelect }: CaptureSourceStepProps) => (
  <View accessibilityRole="menu">
    <ListGroup dividerInset="text">
      {options.map((option, index) => (
        <OptionRow key={option.id} option={option} index={index} disabled={disabled} onSelect={onSelect} />
      ))}
    </ListGroup>
  </View>
);

export default CaptureSourceStep;
