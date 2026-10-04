import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CaretRightIcon, type Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { IconSize } from "@/theme";
import { useEntrance } from "@/hooks/use-entrance";

import createStyles from "./styles";

export type DestinationRowProps = {
  label: string;
  detail?: string;
  icon: Icon;
  onPress: () => void;
  index?: number;
  testID?: string;
};

const DestinationRow = ({ label, detail, icon: IconComponent, onPress, index = 0, testID }: DestinationRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(onPress);
  const entering = useEntrance(index, "tight");

  return (
    <Animated.View entering={entering}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={detail}
        onPress={press}
        style={styles.row}
        pressedStyle={styles.pressed}
        testID={testID}
      >
        <IconTile icon={IconComponent} radius="md" />
        <View style={styles.copy}>
          <ThemedText variant="label" numberOfLines={1}>
            {label}
          </ThemedText>
          {detail ? (
            <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
              {detail}
            </ThemedText>
          ) : null}
        </View>
        <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} weight="regular" />
      </PressableScale>
    </Animated.View>
  );
};

export default DestinationRow;
