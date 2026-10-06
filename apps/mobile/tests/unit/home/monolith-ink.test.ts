import { monolithInk } from "@/features/home/utils/monolith";
import { Colors, createTheme, Palette } from "@/theme";

const themeFor = (scheme: "graphite" | "graphiteLight") => createTheme({ scheme, width: 390, height: 844 });

describe("monolithInk", () => {
  it("keeps the pale stone on the dark canvas", () => {
    const ink = monolithInk(themeFor("graphite"));
    expect(ink.face[0]).toBe(Colors.graphite.text);
    expect(ink.glow).toBe(Colors.graphite.text);
  });

  it("draws a grey stone with a white spark on the light canvas", () => {
    const ink = monolithInk(themeFor("graphiteLight"));
    expect(ink.face).not.toContain(Colors.graphiteLight.text);
    expect(ink.face[0]).not.toBe(Colors.graphiteLight.background);
    expect(ink.glow).toBe(Palette.white);
    expect(ink.ink).toBe(Colors.graphiteLight.text);
  });
});
