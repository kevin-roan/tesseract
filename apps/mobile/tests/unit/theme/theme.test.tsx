import * as ReactNative from "react-native";
import { renderHook } from "@testing-library/react-native";

import { useColorScheme as useWebColorScheme } from "@/hooks/use-color-scheme.web";
import { useResponsive } from "@/hooks/use-responsive";
import { createTheme, type SurfaceTone } from "@/theme";
import { BaseTabletWidth, BaseWidth, clamp, moderateScale, scale, scaleFont, scaleRatio } from "@/theme/responsive";
import {
  isBreakpointDown,
  isBreakpointUp,
  isTablet,
  resolveBreakpoint,
  resolveDeviceClass,
  resolveResponsive,
} from "@/theme/tokens/breakpoints";

describe("breakpoints", () => {
  it("resolves the breakpoint for a width", () => {
    expect([0, 379, 380, 599, 600, 839, 840, 1179, 1180, 2000].map(resolveBreakpoint)).toEqual([
      "xs",
      "xs",
      "sm",
      "sm",
      "md",
      "md",
      "lg",
      "lg",
      "xl",
      "xl",
    ]);
  });

  it("classifies devices by their short side so rotation does not flip them", () => {
    expect(resolveDeviceClass(375, 667)).toBe("phone");
    expect(resolveDeviceClass(430, 932)).toBe("phoneLarge");
    expect(resolveDeviceClass(932, 430)).toBe("phoneLarge");
    expect(resolveDeviceClass(744, 1024)).toBe("tablet");
    expect(resolveDeviceClass(1366, 1024)).toBe("tabletLarge");
    expect(isTablet(1024, 744)).toBe(true);
    expect(isTablet(932, 430)).toBe(false);
  });

  it("compares widths against breakpoints", () => {
    expect(isBreakpointUp(600, "md")).toBe(true);
    expect(isBreakpointUp(599, "md")).toBe(false);
    expect(isBreakpointDown(599, "md")).toBe(true);
    expect(isBreakpointDown(600, "md")).toBe(false);
  });

  it("falls back to the nearest smaller declared value", () => {
    expect(resolveResponsive({ xs: 1, lg: 2 }, "md")).toBe(1);
    expect(resolveResponsive({ xs: 1, lg: 2 }, "xl")).toBe(2);
    expect(resolveResponsive({ md: 3 }, "sm")).toBeUndefined();
    expect(resolveResponsive(5, "xl")).toBe(5);
    expect(resolveResponsive<unknown>(null, "xl")).toBeNull();
    expect(resolveResponsive<unknown>([1, 2], "xl")).toEqual([1, 2]);
    expect(resolveResponsive<unknown>({ wide: 1 }, "xl")).toEqual({ wide: 1 });
  });
});

describe("responsive scaling", () => {
  it("clamps the ratio against the phone or tablet baseline", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(scaleRatio(BaseWidth, 844)).toBe(1);
    expect(scaleRatio(BaseTabletWidth, 1194)).toBe(1);
    expect(scaleRatio(200, 400)).toBe(0.85);
    expect(scaleRatio(3000, 3000)).toBe(1.35);
  });

  it("scales sizes linearly, moderately and for type", () => {
    expect(scale(10, BaseWidth, 844)).toBe(10);
    expect(moderateScale(16, BaseWidth, 844)).toBe(16);
    expect(moderateScale(16, 3000, 3000, 0)).toBe(16);
    expect(moderateScale(16, 3000, 3000, 1)).toBeCloseTo(21.6, 0);
    expect(scaleFont(16, 3000, 3000)).toBeCloseTo(18.4, 0);
  });
});

describe("createTheme", () => {
  it("builds light phone and dark tablet themes", () => {
    const phone = createTheme({ scheme: "light", width: 390, height: 844 });
    const tablet = createTheme({ scheme: "dark", width: 1024, height: 1366 });
    expect(phone.scheme).toBe("light");
    expect(tablet.scheme).toBe("dark");
    expect(phone.isTablet).toBe(false);
    expect(tablet.isTablet).toBe(true);
    expect(tablet.colors.background).not.toBe(phone.colors.background);
  });
});

describe("useResponsive", () => {
  it("derives viewport state and helpers from the window size", async () => {
    const { width, height } = ReactNative.Dimensions.get("window");
    const { result } = await renderHook(() => useResponsive());

    expect(result.current).toMatchObject({
      width,
      height,
      breakpoint: resolveBreakpoint(width),
      device: resolveDeviceClass(width, height),
      isTablet: isTablet(width, height),
      isPhone: !isTablet(width, height),
      isLandscape: width > height,
    });
    expect(result.current.select({ xs: "base" })).toBe("base");
    expect(result.current.up("xs")).toBe(true);
    expect(result.current.down("xs")).toBe(false);
  });
});

describe("useColorScheme (web)", () => {
  it("returns the system scheme once hydrated on the client", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const { result } = await renderHook(() => useWebColorScheme());
    expect(result.current).toBe("dark");
    scheme.mockRestore();
  });
});

describe("color system", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) =>
      v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it.each(["light", "dark"] as const)("keeps status ink AA on its muted fill and the background (%s)", (scheme) => {
    const { colors } = createTheme({ scheme, width: 390, height: 844 });
    for (const status of ["success", "warning", "danger", "info"] as const) {
      expect(contrast(colors[status], colors[`${status}Muted`])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors[status], colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors[`${status}Solid`], colors.background)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(colors.textSecondary, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textTertiary, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textOnNotification, colors.notification)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["light", "dark"] as const)("ships six distinct chart hues that hold 3:1 on the background (%s)", (scheme) => {
    const { chart, colors } = createTheme({ scheme, width: 390, height: 844 });
    expect(chart.categorical).toHaveLength(6);
    expect(new Set(chart.categorical).size).toBe(6);
    for (const color of chart.categorical) expect(contrast(color, colors.background)).toBeGreaterThanOrEqual(3);
    expect(chart.categorical[0]).toBe(chart.named.indigo);
    expect(chart.sequential).toHaveLength(5);
  });

  it.each(["light", "dark"] as const)("inks every surface tone so text stays legible on its fill (%s)", (scheme) => {
    const tones: SurfaceTone[] = ["neutral", "brand", "violet", "indigo", "yellow", "lavender", "mint", "rose", "sky", "sand", "ink"];
    for (const tone of tones) {
      const { colors, surfaces } = createTheme({ scheme, width: 390, height: 844, tone });
      const { fill } = surfaces[tone];
      expect(contrast(colors.text, fill.outer)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.text, fill.inner)).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(["light", "dark"] as const)("keeps badges and the primary pill AA (%s)", (scheme) => {
    const { colors } = createTheme({ scheme, width: 390, height: 844 });
    expect(contrast(colors.badgeText, colors.badge)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.accentInk, colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.accentStrong, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.selection, colors.background)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the base colors outside a surface", () => {
    const base = createTheme({ scheme: "light", width: 390, height: 844 });
    const ink = createTheme({ scheme: "light", width: 390, height: 844, tone: "ink" });
    const violet = createTheme({ scheme: "light", width: 390, height: 844, tone: "violet" });
    expect(ink.colors.text).not.toBe(base.colors.text);
    expect(violet.colors.accent).toBe(base.colors.accent);
    expect(createTheme({ scheme: "light", width: 390, height: 844 })).toBe(base);
  });
});
