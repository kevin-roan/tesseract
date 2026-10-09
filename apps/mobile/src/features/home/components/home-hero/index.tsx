import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Canvas, LinearGradient, Rect, vec } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import Animated, { Easing, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { obeliskCrop } from "@/components/splash-overlay/geometry";
import ObeliskLight from "@/components/splash-overlay/obelisk-light";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { useScreenActive } from "@/hooks/use-screen-active";
import { Palette, SplashMotion } from "@/theme";

import createStyles from "./styles";

const SPLASH = require("@/assets/images/splash.png");

/** The splash's light, fixed like the splash image itself. */
const LIGHT = Palette.clay[400];

/** How far in from each edge the splash fades out, as a fraction of the box. */
const FEATHER = { x: 0.22, y: 0.18 };

/**
 * The launch splash brought onto the home screen: the obelisk, cropped to fit,
 * with the same light tracing it — a glow at the tip, the roof edges drawing
 * out, a spark down the ridge. It replays each time Home comes back into view.
 *
 * The image is drawn by expo-image, like the splash itself: Skia's `useImage`
 * can't resolve bundled assets in release and EAS Update builds, which left only
 * the light. Skia draws the light and fades every edge into the screen
 * background, so the obelisk sits on the screen rather than in a card.
 */
const HomeHero = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const markEntering = useEntrance(0, "loose");
  const reduceMotion = useReducedMotion();
  const active = useScreenActive();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const crop = useMemo(() => obeliskCrop(size.width, size.height), [size]);
  const clock = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    clock.set(0);
    clock.set(withTiming(1, { duration: reduceMotion ? 0 : SplashMotion.intro, easing: Easing.linear }));
  }, [active, reduceMotion, clock]);

  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  const { placement, geometry } = crop;
  const { width, height } = size;
  const edge = theme.colors.background;
  const featherX = width * FEATHER.x;
  const featherY = height * FEATHER.y;

  return (
    <View style={styles.container}>
      <Animated.View
        entering={markEntering}
        style={styles.panel}
        onLayout={measure}
        testID="home-obelisk"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {width > 0 ? (
          <>
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
              <ObeliskLight geometry={geometry} clock={clock} color={LIGHT} />
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
            </Canvas>
          </>
        ) : null}
      </Animated.View>
    </View>
  );
};

export default HomeHero;
