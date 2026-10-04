import { fireEvent, render, screen } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import SplashOverlay from "@/components/splash-overlay";
import { layoutGlyphs, obeliskGeometry } from "@/components/splash-overlay/geometry";
import { segment } from "@/hooks/use-splash-timeline";
import type { SkFont } from "@shopify/react-native-skia";

jest.mock("expo-splash-screen", () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));

describe("<SplashOverlay />", () => {
  it("keeps the native splash until its own image is on screen", async () => {
    await render(<SplashOverlay ready={false} title="Monolith" onDone={jest.fn()} />);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId("splash-image", { includeHiddenElements: true }), "display");
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});

describe("splash geometry", () => {
  it("maps the obelisk tip onto a cover-fitted screen", () => {
    const { tip, leftShoulder, rightShoulder } = obeliskGeometry(393, 852);
    expect(tip.x).toBeCloseTo(205.1, 0);
    expect(tip.y).toBeGreaterThan(852 / 2);
    expect(leftShoulder.x).toBeLessThan(tip.x);
    expect(rightShoulder.x).toBeGreaterThan(tip.x);
  });

  it("centers the glyph run with tracking", () => {
    const font = {
      getSize: () => 10,
      getGlyphIDs: (text: string) => [...text].map((_, i) => i),
      getGlyphWidths: (ids: number[]) => ids.map(() => 10),
    } as unknown as SkFont;
    const { glyphs, width, left } = layoutGlyphs(font, "abc", 100, 0.1);
    expect(width).toBe(32);
    expect(left).toBe(84);
    expect(glyphs.map((g) => g.x)).toEqual([84, 95, 106]);
  });

  it("eases a timeline slice and clamps outside it", () => {
    expect(segment(0, 0.2, 0.6)).toBe(0);
    expect(segment(1, 0.2, 0.6)).toBe(1);
    expect(segment(0.4, 0.2, 0.6)).toBeCloseTo(0.875);
  });
});
