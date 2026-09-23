import { SparkleIcon } from "phosphor-react-native";
import { useMemo } from "react";
import { Platform, Pressable, type PressableProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";
import createStyles from "./styles";

const TabBarHeight = Platform.select({ ios: 49, default: 80 });

type AiFabProps = Pick<PressableProps, "onPress">;

const AiFab = ({ onPress }: AiFabProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(theme, TabBarHeight + insets.bottom + theme.spacing.base),
    [theme, insets.bottom],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask AI"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <SparkleIcon color={theme.colors.textOnAccent} size={IconSize.lg} weight="fill" />
    </Pressable>
  );
};

export default AiFab;
