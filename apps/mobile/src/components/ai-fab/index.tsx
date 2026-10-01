import { SparkleIcon } from "phosphor-react-native";
import { useMemo } from "react";
import { Pressable, type PressableProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { BottomTabInset, IconSize } from "@/theme";
import createStyles from "./styles";

type AiFabProps = Pick<PressableProps, "onPress"> & {
  /** Screen-reader label. */
  label?: string;
};

/** Floating assistant shortcut, parked above the tab bar and the home indicator. */
const AiFab = ({ onPress, label = "Ask AI" }: AiFabProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(theme, BottomTabInset + insets.bottom + theme.spacing.base),
    [theme, insets.bottom],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <SparkleIcon color={theme.colors.textOnAccent} size={IconSize.lg} weight="fill" />
    </Pressable>
  );
};

export default AiFab;
