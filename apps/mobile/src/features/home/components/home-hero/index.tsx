import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Canvas, Group, Image, LinearGradient, Mask, Rect, useImage, vec } from "@shopify/react-native-skia";
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

/** An alpha ramp across `length`: clear at both ends, opaque in between. */
const featherStops = (fraction: number) => [0, fraction, 1 - fraction, 1];
const FEATHER_COLORS = ["transparent", "black", "black", "transparent"];

/**
 * The launch splash brought onto the home screen: the obelisk, cropped to fit,
 * with the same light tracing it — a glow at the tip, the roof edges drawing
 * out, a spark down the ridge. It replays each time Home comes back into view.
 * The image's dark backdrop is feathered out at every edge so the obelisk sits
 * on the screen itself rather than in a card.
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
  const splash = useImage(SPLASH);

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
          <Canvas style={StyleSheet.absoluteFill}>
            <Mask
              mask={
                <Rect x={0} y={0} width={width} height={height}>
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(0, height)}
                    colors={FEATHER_COLORS}
                    positions={featherStops(FEATHER.y)}
                  />
                </Rect>
              }
            >
              <Mask
                mask={
                  <Rect x={0} y={0} width={width} height={height}>
                    <LinearGradient
                      start={vec(0, 0)}
                      end={vec(width, 0)}
                      colors={FEATHER_COLORS}
                      positions={featherStops(FEATHER.x)}
                    />
                  </Rect>
                }
              >
                <Group>
                  {splash ? (
                    <Image
                      image={splash}
                      fit="fill"
                      x={placement.dx}
                      y={placement.dy}
                      width={placement.width}
                      height={placement.height}
                    />
                  ) : null}
                  <ObeliskLight geometry={geometry} clock={clock} color={LIGHT} />
                </Group>
              </Mask>
            </Mask>
          </Canvas>
        ) : null}
      </Animated.View>
    </View>
  );
};

export default HomeHero;
