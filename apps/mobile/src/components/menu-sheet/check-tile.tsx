import { useMemo } from "react";
import { CheckIcon } from "phosphor-react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { MotionEasing } from "@/lib/motion";
import { Durations, IconSize } from "@/theme";

import createStyles from "./styles";

/** Soft rounded tile with a check that pops in on the selected option. Decorative; the row carries the state. */
const CheckTile = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View
      entering={ZoomIn.duration(Durations.normal).easing(MotionEasing)}
      style={styles.check}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <CheckIcon size={IconSize.xs} color={theme.colors.accentInk} weight="bold" />
    </Animated.View>
  );
};

export default CheckTile;
