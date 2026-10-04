import { useMemo } from "react";
import Svg, { Line } from "react-native-svg";

import { useAppTheme } from "@/hooks/use-app-theme";

import { DEFAULT_MARK_SIZE, STROKE_RATIO, starburstRays } from "./utils/rays";

export type ClaudeMarkProps = {
  size?: number;
  color?: string;
  testID?: string;
};

const ClaudeMark = ({ size = DEFAULT_MARK_SIZE, color, testID }: ClaudeMarkProps) => {
  const { colors, look } = useAppTheme();
  const strokeWidth = size * STROKE_RATIO;
  const rays = useMemo(() => starburstRays(size, strokeWidth), [size, strokeWidth]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {rays.map((ray, index) => (
        <Line key={index} {...ray} stroke={color ?? colors.brand} strokeWidth={strokeWidth} strokeLinecap={look === "graphite" ? "butt" : "round"} />
      ))}
    </Svg>
  );
};

export default ClaudeMark;
