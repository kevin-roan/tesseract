import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CaretRightIcon, type Icon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type DestinationRowProps = {
  label: string;
  detail?: string;
  icon: Icon;
  onPress: () => void;
  testID?: string;
};

const DestinationRow = ({ label, detail, icon: IconComponent, onPress, testID }: DestinationRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(onPress);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={press}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={testID}
    >
      <IconComponent size={IconSize.md} color={theme.colors.accentStrong} weight="bold" />
      <View style={styles.copy}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {label}
        </ThemedText>
        {detail ? (
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} weight="bold" />
    </Pressable>
  );
};

export default DestinationRow;
