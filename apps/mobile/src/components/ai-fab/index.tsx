import { SparkleIcon } from "phosphor-react-native";
import { useMemo } from "react";
import type { PressableProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { IconSize } from "@/theme";
import createStyles from "./styles";

type AiFabProps = Pick<PressableProps, "onPress"> & {
  /** Screen-reader label. */
  label?: string;
};

/** Floating assistant shortcut, parked above the tab bar and the home indicator. */
const AiFab = ({ onPress, label = "Ask AI" }: AiFabProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const styles = useMemo(
    () => createStyles(theme, tabBarInset + insets.bottom + theme.spacing.base),
    [theme, tabBarInset, insets.bottom],
  );

  return (
    <PressableScale depth="control" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.fab} pressedStyle={styles.pressed}>
      <SparkleIcon color={theme.colors.textOnAccent} size={IconSize.lg} weight={theme.look === "graphite" ? "light" : "fill"} />
    </PressableScale>
  );
};

export default AiFab;
