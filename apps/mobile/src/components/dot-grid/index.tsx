import { memo, useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { useAppTheme } from "@/hooks/use-app-theme";

import { DOT_RADIUS } from "./styles";

/** The faint dot grid graphite screens sit on. Decorative, never hit-tested. */
const DotGrid = () => {
  const theme = useAppTheme();
  const rawId = useId();
  const id = `dots${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const step = theme.spacing.lg;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <Pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
          <Circle cx={step / 2} cy={step / 2} r={DOT_RADIUS} fill={theme.colors.backgroundPattern} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
};

export default memo(DotGrid);
