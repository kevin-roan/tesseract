import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BlurMask, Canvas, LinearGradient, Path, Rect, vec } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import type { SharedValue } from "react-native-reanimated";

import type { ObeliskGeometry } from "@/components/splash-overlay/geometry";
import { useAppTheme } from "@/hooks/use-app-theme";

import { MONOLITH } from "./constants";
import EdgeLight from "./edge-light";
import { useMonolith } from "./use-monolith";

const SPLASH = require("@/assets/images/splash.png");

export type MonolithProps = {
  width: number;
  height: number;
  /** 0→1 clock that draws the edge light. */
  clock: SharedValue<number>;
  /** Share of the width the obelisk spans. */
  span?: number;
  /** Extra Skia drawing over the obelisk, placed with its geometry. */
  overlay?: (geometry: ObeliskGeometry) => ReactNode;
  testID?: string;
};

/**
 * The splash obelisk, cropped to a `width` × `height` box and faded into the
 * screen background on every side, with a thin light along its edges and fine
 * particles drifting up past it.
 *
 * The image is drawn by expo-image, like the splash itself: Skia's `useImage`
 * can't resolve bundled assets in release and EAS Update builds.
 */
const Monolith = ({ width, height, clock, span, overlay, testID }: MonolithProps) => {
  const theme = useAppTheme();
  const { placement, geometry, particles } = useMonolith(width, height, span);
  const edge = theme.colors.background;
  const featherX = width * MONOLITH.feather.x;
  const featherY = height * MONOLITH.feather.y;

  return (
    <View style={{ width, height }} testID={testID}>
      <Image
        source={SPLASH}
        contentFit="fill"
        style={{
          position: "absolute",
          left: placement.dx,
          top: placement.dy,
          width: placement.width,
          height: placement.height,
        }}
      />
      <Canvas style={StyleSheet.absoluteFill}>
        <EdgeLight geometry={geometry} clock={clock} color={MONOLITH.light} />
        {overlay?.(geometry)}
        <Rect x={0} y={0} width={width} height={featherY}>
          <LinearGradient start={vec(0, 0)} end={vec(0, featherY)} colors={[edge, "transparent"]} />
        </Rect>
        <Rect x={0} y={height - featherY} width={width} height={featherY}>
          <LinearGradient start={vec(0, height)} end={vec(0, height - featherY)} colors={[edge, "transparent"]} />
        </Rect>
        <Rect x={0} y={0} width={featherX} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(featherX, 0)} colors={[edge, "transparent"]} />
        </Rect>
        <Rect x={width - featherX} y={0} width={featherX} height={height}>
          <LinearGradient start={vec(width, 0)} end={vec(width - featherX, 0)} colors={[edge, "transparent"]} />
        </Rect>
        <Path path={particles} color={MONOLITH.light} opacity={0.5}>
          <BlurMask blur={0.6} style="solid" />
        </Path>
      </Canvas>
    </View>
  );
};

export default Monolith;
