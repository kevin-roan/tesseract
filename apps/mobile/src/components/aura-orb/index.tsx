import { useMemo } from "react";
import { Canvas, Fill, Shader, Skia, useClock } from "@shopify/react-native-skia";
import { useDerivedValue, useReducedMotion } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";

import { auraShader } from "./shader";
import createStyles from "./styles";

export type AuraOrbProps = {
  size: number;
};

const toVec4 = (color: string) => Array.from(Skia.Color(color));

/** Soft, slowly drifting pink-to-violet glow drawn with a Skia shader. */
const AuraOrb = ({ size }: AuraOrbProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(size), [size]);
  const reduceMotion = useReducedMotion();
  const clock = useClock();
  const warm = useMemo(() => toVec4(theme.colors.auraWarm), [theme.colors.auraWarm]);
  const cool = useMemo(() => toVec4(theme.colors.auraCool), [theme.colors.auraCool]);

  const uniforms = useDerivedValue(() => ({
    size: [size, size],
    time: reduceMotion ? 0 : clock.value / 1000,
    warm,
    cool,
  }));

  if (!auraShader) return null;

  return (
    <Canvas style={styles.canvas} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Fill>
        <Shader source={auraShader} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
};

export default AuraOrb;
