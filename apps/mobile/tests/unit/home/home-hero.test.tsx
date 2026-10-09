import { render, screen } from "@testing-library/react-native";

import HomeHero from "@/features/home/components/home-hero";

describe("<HomeHero />", () => {
  it("shows the Tesseract wordmark", async () => {
    await render(<HomeHero />);
    expect(screen.getByTestId("home-wordmark")).toBeOnTheScreen();
    expect(screen.getByText("Tesseract")).toBeOnTheScreen();
  });
});
