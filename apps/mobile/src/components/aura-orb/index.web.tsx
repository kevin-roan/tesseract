import { useMemo } from "react";
import { View, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type AuraOrbProps = {
  size: number;
};

const AuraOrb = ({ size }: AuraOrbProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(size), [size]);
  const glow = useMemo(
    () =>
      ({
        backgroundImage: `radial-gradient(circle at 42% 38%, ${theme.colors.auraWarm}, ${theme.colors.auraCool} 45%, transparent 70%)`,
        filter: `blur(${size / 10}px)`,
      }) as ViewStyle,
    [theme.colors.auraWarm, theme.colors.auraCool, size],
  );

  return <View pointerEvents="none" style={[styles.canvas, glow]} />;
};

export default AuraOrb;
