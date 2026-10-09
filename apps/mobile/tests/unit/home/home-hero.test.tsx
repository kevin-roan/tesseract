import { fireEvent, render, screen } from "@testing-library/react-native";

import { obeliskCrop } from "@/components/splash-overlay/geometry";
import HomeHero from "@/features/home/components/home-hero";
import { heroBox } from "@/features/home/utils/hero";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

describe("<HomeHero />", () => {
  it("draws the splash obelisk", async () => {
    await render(<HomeHero />);
    const panel = screen.getByTestId("home-obelisk", {
      includeHiddenElements: true,
    });
    await fireEvent(panel, "layout", {
      nativeEvent: { layout: { width: 360, height: 420 } },
    });
    expect(panel.children.length).toBeGreaterThan(0);
  });
});

describe("heroBox", () => {
  it("keeps the monolith narrower than the panel and no taller than it", () => {
    expect(heroBox({ width: 360, height: 420 })).toEqual({
      width: 360 * 0.62,
      height: 360 * 0.62 * 1.4,
    });
    expect(heroBox({ width: 360, height: 200 }).height).toBe(200);
    expect(heroBox({ width: 900, height: 900 }).width).toBe(260);
  });
});

describe("obeliskCrop", () => {
  it.each([
    [360, 420],
    [360, 200],
    [700, 900],
  ])("centres the tip and covers a %ix%i box", (width, height) => {
    const { placement, geometry } = obeliskCrop(width, height);
    expect(geometry.tip.x).toBeCloseTo(width / 2);
    expect(placement.dx).toBeLessThanOrEqual(0);
    expect(placement.dy).toBeLessThanOrEqual(0);
    expect(placement.dx + placement.width).toBeGreaterThanOrEqual(width - 0.001);
    expect(placement.dy + placement.height).toBeGreaterThanOrEqual(height - 0.001);
    expect(geometry.ridgeBottom).toBe(height);
  });
});
