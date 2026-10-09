import { render, screen } from "@testing-library/react-native";

import { obeliskCrop } from "@/components/splash-overlay/geometry";
import HomeHero from "@/features/home/components/home-hero";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

describe("<HomeHero />", () => {
  it("draws the splash obelisk", async () => {
    await render(<HomeHero />);
    expect(screen.getByTestId("home-obelisk", { includeHiddenElements: true })).toBeTruthy();
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
