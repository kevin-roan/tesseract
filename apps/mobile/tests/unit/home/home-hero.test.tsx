import { render, screen } from "@testing-library/react-native";

import HomeHero from "@/features/home/components/home-hero";
import { HEADLINES } from "@/features/home/components/home-hero/headline";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

describe("<HomeHero />", () => {
  it("draws the tesseract and announces the first headline", async () => {
    await render(<HomeHero />);
    expect(screen.getByTestId("home-tesseract", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("header", { name: HEADLINES[0] })).toBeOnTheScreen();
  });
});
