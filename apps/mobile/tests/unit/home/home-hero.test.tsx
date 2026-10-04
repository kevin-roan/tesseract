import { render, screen } from "@testing-library/react-native";

import HomeHero from "@/features/home/components/home-hero";
import { HEADLINES } from "@/features/home/components/home-hero/headline";
import { sparkState } from "@/features/home/components/home-hero/scene-clock";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

describe("<HomeHero />", () => {
  it("draws the monolith and announces the first headline", async () => {
    await render(<HomeHero />);
    expect(screen.getByTestId("home-monolith", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("header", { name: HEADLINES[0] })).toBeOnTheScreen();
  });
});

describe("sparkState", () => {
  it("climbs from the base to the tip, then flares", () => {
    expect(sparkState(0).climb).toBe(0);
    expect(sparkState(1.5).climb).toBeGreaterThan(0);
    expect(sparkState(3).climb).toBe(1);
    expect(sparkState(2.9).flare).toBe(0);
    expect(sparkState(3.1).flare).toBeGreaterThan(0.5);
    expect(sparkState(3.1).visible).toBe(0);
  });
});
