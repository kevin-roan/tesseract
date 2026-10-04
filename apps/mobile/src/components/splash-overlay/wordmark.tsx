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
  /** Ink the letters arrive in. */
  color: string;
  /** Ink the light sweep leaves behind. */
  shineColor: string;
  ruleColor: string;
  /** Extra space between letters, in em. Negative tightens. */
  tracking?: number;
};

type GlyphProps = {
  font: SkFont;
  id: number;
  x: number;
  baseline: number;
  index: number;
  clock: SharedValue<number>;
  color: string;
};

const Glyph = ({ font, id, x, baseline, index, clock, color }: GlyphProps) => {
  const rise = font.getSize() * 0.35;
  const progress = useDerivedValue(() => {
    const from = index * SplashMotion.letterStagger;
    return segment(clock.value, from, from + SplashMotion.letterSettle);
  });
  const opacity = useDerivedValue(() => progress.value);
  const transform = useDerivedValue(() => [{ translateY: (1 - progress.value) * rise }]);
  const blur = useDerivedValue(() => (1 - progress.value) * 10);

  return (
    <Group opacity={opacity} transform={transform}>
      <Glyphs font={font} glyphs={[{ id, pos: { x, y: baseline } }]} color={color}>
        <Blur blur={blur} mode="decal" />
      </Glyphs>
    </Group>
  );
};

/**
 * The app name drawn on the GPU: letters rise out of a blur one after another,
 * a hairline rule draws out from the center, then a soft edge of light crosses
 * the word and leaves it lit. Lifts and fades with the exit.
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
  tracking = -0.03,
}: WordmarkProps) => {
  const { glyphs, width, left } = useMemo(
    () => layoutGlyphs(font, text, centerX, tracking),
    [font, text, centerX, tracking],
  );
  const size = font.getSize();
  const band = width * 0.35;
  const top = baseline - size;
  const ruleY = baseline + size * 0.55;
  const ruleHalf = width * 0.18;

  const groupOpacity = useDerivedValue(() => 1 - segment(exit.value, 0, 0.7));
  const groupTransform = useDerivedValue(() => [{ translateY: -exit.value * size * 0.25 }]);

  const sweep = useDerivedValue(() => left + (width + band) * segment(clock.value, 0.5, 1));
  const shineStart = useDerivedValue(() => ({ x: sweep.value - band, y: top }));
  const shineEnd = useDerivedValue(() => ({ x: sweep.value, y: baseline }));

  const rule = useDerivedValue(() => segment(clock.value, 0.3, 0.75) * ruleHalf);
  const ruleStart = useDerivedValue(() => ({
    x: centerX - rule.value,
    y: ruleY,
  }));
  const ruleEnd = useDerivedValue(() => ({
    x: centerX + rule.value,
    y: ruleY,
  }));

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
            index={index}
            clock={clock}
            color={color}
          />
        ))}
        <Rect x={left - band} y={top} width={width + band * 2} height={size * 1.4} blendMode="srcATop">
          <LinearGradient start={shineStart} end={shineEnd} colors={[shineColor, "transparent"]} />
        </Rect>
      </Group>
      <Line p1={ruleStart} p2={ruleEnd} color={ruleColor} strokeWidth={1} />
    </Group>
  );
};

export default Wordmark;
