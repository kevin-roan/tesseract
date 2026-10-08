import { useMemo } from "react";
import { Blur, Glyphs, Group, Line, LinearGradient, Rect, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { segment } from "@/hooks/use-splash-timeline";
import { SplashMotion } from "@/theme";

import { layoutGlyphs } from "./geometry";

export type WordmarkProps = {
  font: SkFont;
  text: string;
  centerX: number;
  baseline: number;
  clock: SharedValue<number>;
  exit: SharedValue<number>;
  /** Ink the letters settle in. */
  color: string;
  /** Glint that crosses the word once it has settled. */
  shineColor: string;
  ruleColor: string;
  /** Extra space between letters, in em. */
  tracking?: number;
};

type GlyphProps = {
  font: SkFont;
  id: number;
  x: number;
  baseline: number;
  /** Steps away from the middle letter; the word opens from the center out. */
  order: number;
  /** Distance the letter drifts outward while it settles. */
  drift: number;
  clock: SharedValue<number>;
  color: string;
};

const Glyph = ({ font, id, x, baseline, order, drift, clock, color }: GlyphProps) => {
  const progress = useDerivedValue(() => {
    const from = order * SplashMotion.letterStagger;
    return segment(clock.value, from, from + SplashMotion.letterSettle);
  });
  const opacity = useDerivedValue(() => progress.value);
  const transform = useDerivedValue(() => [{ translateX: (progress.value - 1) * drift }]);
  const blur = useDerivedValue(() => (1 - progress.value) * 6);

  return (
    <Group opacity={opacity} transform={transform}>
      <Glyphs font={font} glyphs={[{ id, pos: { x, y: baseline } }]} color={color}>
        <Blur blur={blur} mode="decal" />
      </Glyphs>
    </Group>
  );
};

/**
 * The app name drawn on the GPU: widely tracked capitals open from the middle
 * letter outward, each drifting into place out of a blur, a hairline rule draws
 * out beneath them, then a narrow glint crosses the word. Lifts and fades with the exit.
 */
const Wordmark = ({
  font,
  text,
  centerX,
  baseline,
  clock,
  exit,
  color,
  shineColor,
  ruleColor,
  tracking = 0.36,
}: WordmarkProps) => {
  const { glyphs, width, left } = useMemo(
    () => layoutGlyphs(font, text.toUpperCase(), centerX, tracking),
    [font, text, centerX, tracking],
  );
  const size = font.getSize();
  const middle = (glyphs.length - 1) / 2;
  const band = size * 1.6;
  const top = baseline - size;
  const ruleY = baseline + size * 0.9;
  const ruleHalf = width * 0.22;

  const groupOpacity = useDerivedValue(() => 1 - segment(exit.value, 0, 0.7));
  const groupTransform = useDerivedValue(() => [{ translateY: -exit.value * size * 0.5 }]);

  const sweep = useDerivedValue(() => left - band + (width + band * 2) * segment(clock.value, 0.55, 1));
  const shineStart = useDerivedValue(() => ({ x: sweep.value - band / 2, y: top }));
  const shineEnd = useDerivedValue(() => ({ x: sweep.value + band / 2, y: baseline }));

  const rule = useDerivedValue(() => segment(clock.value, 0.35, 0.8) * ruleHalf);
  const ruleStart = useDerivedValue(() => ({ x: centerX - rule.value, y: ruleY }));
  const ruleEnd = useDerivedValue(() => ({ x: centerX + rule.value, y: ruleY }));

  return (
    <Group opacity={groupOpacity} transform={groupTransform}>
      <Group layer>
        {glyphs.map((glyph, index) => (
          <Glyph
            key={index}
            font={font}
            id={glyph.id}
            x={glyph.x}
            baseline={baseline}
            order={Math.abs(index - middle)}
            drift={(index - middle) * size * 0.12}
            clock={clock}
            color={color}
          />
        ))}
        <Rect x={left - band} y={top} width={width + band * 2} height={size * 1.4} blendMode="srcATop">
          <LinearGradient
            start={shineStart}
            end={shineEnd}
            colors={["transparent", shineColor, "transparent"]}
            mode="decal"
          />
        </Rect>
      </Group>
      <Line p1={ruleStart} p2={ruleEnd} color={ruleColor} strokeWidth={1} />
    </Group>
  );
};

export default Wordmark;
