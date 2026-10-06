import { Appearance } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useAppScheme } from "@/features/settings/hooks/use-app-scheme";
import { useSettingsStore } from "@/features/settings/store/settings-store";
import { isAppearancePreference, nativeScheme, resolveMode, schemeForMode } from "@/features/settings/utils/appearance";
import { DEFAULT_APPEARANCE, SETTINGS_STORE_NAME } from "@/features/settings/utils/constants";
import { ChartColors, Colors, createTheme, Gradients, Surfaces } from "@/theme";

import { __reset as resetKvStore, __seed as seedKvStore } from "../../mocks/expo-sqlite-kv-store";

beforeEach(() => {
  resetKvStore();
  useSettingsStore.setState({ appearance: DEFAULT_APPEARANCE });
});

describe("appearance", () => {
  it("resolves the preference against the device setting", () => {
    expect(resolveMode("system", "light")).toBe("light");
    expect(resolveMode("system", "dark")).toBe("dark");
    expect(resolveMode("system", null)).toBe("dark");
    expect(resolveMode("light", "dark")).toBe("light");
    expect(resolveMode("dark", "light")).toBe("dark");
    expect(schemeForMode("light")).toBe("graphiteLight");
    expect(schemeForMode("dark")).toBe("graphite");
    expect(nativeScheme("system")).toBe("unspecified");
    expect(nativeScheme("light")).toBe("light");
    expect(isAppearancePreference("light")).toBe(true);
    expect(isAppearancePreference("sepia")).toBe(false);
  });

  it("keeps dark as the default and restores a saved choice, ignoring bad values", async () => {
    expect(DEFAULT_APPEARANCE).toBe("dark");
    seedKvStore(SETTINGS_STORE_NAME, JSON.stringify({ state: { appearance: "light" }, version: 1 }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().appearance).toBe("light");

    seedKvStore(SETTINGS_STORE_NAME, JSON.stringify({ state: { appearance: "sepia" }, version: 1 }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().appearance).toBe("light");
  });

  it("drives the app scheme and the native color scheme from the setting", async () => {
    const setColorScheme = jest.spyOn(Appearance, "setColorScheme");
    const { result } = await renderHook(() => useAppScheme());
    expect(result.current).toBe("graphite");
    expect(setColorScheme).toHaveBeenLastCalledWith("dark");

    await act(() => useSettingsStore.getState().setAppearance("light"));
    expect(result.current).toBe("graphiteLight");
    expect(setColorScheme).toHaveBeenLastCalledWith("light");

    await act(() => useSettingsStore.getState().setAppearance("system"));
    expect(setColorScheme).toHaveBeenLastCalledWith("unspecified");
    setColorScheme.mockRestore();
  });
});

describe("graphite light scheme", () => {
  it("declares every table the dark graphite scheme does", () => {
    expect(Object.keys(Colors.graphiteLight).sort()).toEqual(Object.keys(Colors.graphite).sort());
    expect(Object.keys(Surfaces.graphiteLight).sort()).toEqual(Object.keys(Surfaces.graphite).sort());
    expect(Object.keys(Gradients.graphiteLight).sort()).toEqual(Object.keys(Gradients.graphite).sort());
    expect(Object.keys(ChartColors.graphiteLight).sort()).toEqual(Object.keys(ChartColors.graphite).sort());
  });

  it("keeps the graphite look but resolves to light mode", () => {
    const light = createTheme({ scheme: "graphiteLight", width: 390, height: 844 });
    const dark = createTheme({ scheme: "graphite", width: 390, height: 844 });
    expect(light.look).toBe("graphite");
    expect(light.mode).toBe("light");
    expect(dark.mode).toBe("dark");
    expect(light.radius).toEqual(dark.radius);
    expect(light.keyboardAppearance).toBe("light");
    expect(light.colors.background).not.toBe(dark.colors.background);
    expect(light.colors.text).toBe("#0D0D0D");
  });
});
