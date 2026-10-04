import { useCallback, useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Blur, Canvas, Glyphs, Group, LinearGradient, Rect, useFont, type SkFont } from "@shopify/react-native-skia";
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Exo2_500Medium } from "@expo-google-fonts/exo-2/500Medium";

import { layoutGlyphs } from "@/components/splash-overlay/geometry";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useScreenActive } from "@/hooks/use-screen-active";
import { segment } from "@/hooks/use-splash-timeline";

export const HEADLINES = ["Get things done.", "Build something real.", "Ship it today.", "Think. Build. Ship."];

const FONT_SIZE = 34;
const HEIGHT = 56;
const ENTER = 1500;
const HOLD = 3800;
const EXIT = 550;
/** Share of the entrance one letter takes to settle; the rest is stagger. */
const SETTLE = 0.45;

type GlyphProps = {
  font: SkFont;
  id: number;
  x: number;
  baseline: number;
  from: number;
  phase: SharedValue<number>;
  color: string;
};

const Glyph = ({ font, id, x, baseline, from, phase, color }: GlyphProps) => {
  const rise = font.getSize() * 0.4;
  const enter = useDerivedValue(() => segment(Math.min(phase.value, 1), from, from + SETTLE));
  const exit = useDerivedValue(() => Math.min(1, Math.max(0, phase.value - 1)));
  const opacity = useDerivedValue(() => enter.value * (1 - exit.value));
  const transform = useDerivedValue(() => [{ translateY: (1 - enter.value) * rise - exit.value * rise * 0.5 }]);
  const blur = useDerivedValue(() => (1 - enter.value) * 9 + exit.value * 7);

  return (
    <Group opacity={opacity} transform={transform}>
      <Glyphs font={font} glyphs={[{ id, pos: { x, y: baseline } }]} color={color}>
        <Blur blur={blur} mode="decal" />
      </Glyphs>
    </Group>
  );
};

type LineProps = { font: SkFont; text: string; width: number; phase: SharedValue<number> };

const Line = ({ font, text, width, phase }: LineProps) => {
  const { colors } = useAppTheme();
  const centerX = width / 2;
  const { glyphs, width: textWidth, left } = useMemo(
    () => layoutGlyphs(font, text, centerX, -0.02),
    [font, text, centerX],
  );
  const baseline = HEIGHT * 0.68;
  const top = baseline - FONT_SIZE;
  const band = textWidth * 0.4;
  const stagger = glyphs.length > 1 ? (1 - SETTLE) / (glyphs.length - 1) : 0;
  const fit = Math.min(1, (width - 8) / textWidth);

  const sweep = useDerivedValue(() => left + (textWidth + band) * segment(phase.value, 0.5, 1));
  const shineStart = useDerivedValue(() => ({ x: sweep.value - band, y: top }));
  const shineEnd = useDerivedValue(() => ({ x: sweep.value, y: baseline }));

  return (
    <Group layer transform={[{ scale: fit }]} origin={{ x: centerX, y: baseline }}>
      {glyphs.map((glyph, index) => (
        <Glyph
          key={index}
          font={font}
          id={glyph.id}
          x={glyph.x}
          baseline={baseline}
          from={index * stagger}
          phase={phase}
          color={colors.textSecondary}
        />
      ))}
      {/* A soft edge of light crosses the line once it lands and leaves it lit. */}
      <Rect x={left - band} y={top} width={textWidth + band * 2} height={HEIGHT} blendMode="srcATop">
        <LinearGradient start={shineStart} end={shineEnd} colors={[colors.text, "transparent"]} />
      </Rect>
    </Group>
  );
};

/**
 * Rotating home headline drawn on the GPU: each line's letters rise out of a
 * blur one after another, light sweeps across it, then it lifts away into a
 * blur and the next line arrives.
 */
const Headline = () => {
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth - theme.gutter * 2, theme.maxContentWidth);
  const font = useFont(Exo2_500Medium, FONT_SIZE);
  const reduceMotion = useReducedMotion();
  const active = useScreenActive();
  const [index, setIndex] = useState(0);
  const phase = useSharedValue(0);
  const text = HEADLINES[index];
  const advance = useCallback(() => setIndex((i) => (i + 1) % HEADLINES.length), []);

  useEffect(() => {
    if (reduceMotion || !active) {
      phase.value = 1;
      return;
    }
    phase.value = 0;
    phase.value = withSequence(
      withTiming(1, { duration: ENTER, easing: Easing.linear }),
      withDelay(
        HOLD,
        withTiming(2, { duration: EXIT, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(advance);
        }),
      ),
    );
    return () => cancelAnimation(phase);
  }, [index, reduceMotion, active, phase, advance]);

  return (
    <View accessible accessibilityRole="header" accessibilityLabel={text} style={{ width, height: HEIGHT }}>
      <Canvas style={{ width, height: HEIGHT }}>
        {font ? <Line key={index} font={font} text={text} width={width} phase={phase} /> : null}
      </Canvas>
    </View>
  );
};

export default Headline;
