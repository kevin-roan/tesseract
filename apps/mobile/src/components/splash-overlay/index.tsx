import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Canvas, useFont } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Saira_300Light } from "@expo-google-fonts/saira/300Light";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useSplashTimeline } from "@/hooks/use-splash-timeline";
import { Palette } from "@/theme";

import { obeliskGeometry } from "./geometry";
import ObeliskLight from "./obelisk-light";
import Wordmark from "./wordmark";

const SPLASH = require("@/assets/images/splash.png");

/** The splash image is dark in every scheme, so its inks are fixed rather than themed. */
const INK = {
  letters: Palette.stone[200],
  light: Palette.clay[400],
  rule: "rgba(255, 255, 255, 0.18)",
};

export type SplashOverlayProps = {
  /** App is ready to be shown; the overlay hands off once its intro has played. */
  ready: boolean;
  title: string;
  onDone: () => void;
};

/**
 * Animated continuation of the native splash. It draws the same image with the
 * same `cover` fit, takes over from the native splash once that image and the
 * wordmark font are on screen, plays the intro on the GPU, then fades into the app.
 */
const SplashOverlay = ({ ready, title, onDone }: SplashOverlayProps) => {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [imageShown, setImageShown] = useState(false);
  const [fontFailed, setFontFailed] = useState(false);
  const font = useFont(Saira_300Light, Math.round(width * 0.075), () => setFontFailed(true));
  const started = imageShown && (font !== null || fontFailed);
  const { clock, exit } = useSplashTimeline(started, ready, onDone);
  const geometry = useMemo(() => obeliskGeometry(width, height), [width, height]);
  const showImage = useCallback(() => setImageShown(true), []);

  useEffect(() => {
    if (started) SplashScreen.hideAsync();
  }, [started]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 + exit.value * 0.04 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, containerStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={SPLASH}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        onDisplay={showImage}
        testID="splash-image"
      />
      {started ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <ObeliskLight geometry={geometry} clock={clock} color={INK.light} />
          {font ? (
            <Wordmark
              font={font}
              text={title}
              centerX={width / 2}
              baseline={height * 0.3}
              clock={clock}
              exit={exit}
              color={INK.letters}
              shineColor={INK.light}
              ruleColor={INK.rule}
            />
          ) : null}
        </Canvas>
      ) : null}
    </Animated.View>
  );
};

export default SplashOverlay;
