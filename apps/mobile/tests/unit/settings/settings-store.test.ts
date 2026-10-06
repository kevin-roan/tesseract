import { useSettingsStore } from "@/features/settings/store/settings-store";
import { DEFAULT_STT_PROVIDER, SETTINGS_STORE_NAME } from "@/features/settings/utils/constants";

import { __dump as dumpKvStore, __reset as resetKvStore, __seed as seedKvStore } from "../../mocks/expo-sqlite-kv-store";

const saved = (sttProvider: string) => JSON.stringify({ state: { sttProvider }, version: 1 });

beforeEach(() => {
  resetKvStore();
  useSettingsStore.setState({ sttProvider: DEFAULT_STT_PROVIDER, islandPlacement: "bottomRight", islandDock: { edge: "right", offset: 1 }, liveActivity: true, appearance: "dark" });
});

describe("useSettingsStore", () => {
  it("defaults to Gemini transcription", () => {
    expect(DEFAULT_STT_PROVIDER).toBe("gemini");
    expect(useSettingsStore.getState().sttProvider).toBe("gemini");
  });

  it("persists the chosen speech-to-text provider", async () => {
    useSettingsStore.getState().setSttProvider("native");
    expect(useSettingsStore.getState().sttProvider).toBe("native");
    await Promise.resolve();
    expect(JSON.parse(dumpKvStore()[SETTINGS_STORE_NAME]).state).toEqual({ sttProvider: "native", islandPlacement: "bottomRight", islandDock: { edge: "right", offset: 1 }, liveActivity: true, appearance: "dark" });
  });

  it("restores a saved provider and ignores an unknown one", async () => {
    seedKvStore(SETTINGS_STORE_NAME, saved("native"));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().sttProvider).toBe("native");

    useSettingsStore.setState({ sttProvider: "gemini" });
    seedKvStore(SETTINGS_STORE_NAME, saved("openai"));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().sttProvider).toBe("gemini");
  });

  it("persists the island position and live activity choice, ignoring bad values", async () => {
    useSettingsStore.getState().setIslandPlacement("topLeft");
    useSettingsStore.getState().setLiveActivity(false);
    await Promise.resolve();
    expect(JSON.parse(dumpKvStore()[SETTINGS_STORE_NAME]).state).toMatchObject({ islandPlacement: "topLeft", liveActivity: false });

    seedKvStore(SETTINGS_STORE_NAME, JSON.stringify({ state: { islandPlacement: "middle", liveActivity: "yes" }, version: 1 }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({ islandPlacement: "topLeft", liveActivity: false });
  });

  it("moves the orb to a picked corner and keeps a dragged edge dock, ignoring bad docks", async () => {
    useSettingsStore.getState().setIslandPlacement("topLeft");
    expect(useSettingsStore.getState().islandDock).toEqual({ edge: "left", offset: 0 });

    useSettingsStore.getState().setIslandDock({ edge: "top", offset: 0.4 });
    await Promise.resolve();
    expect(JSON.parse(dumpKvStore()[SETTINGS_STORE_NAME]).state).toMatchObject({ islandDock: { edge: "top", offset: 0.4 } });

    seedKvStore(SETTINGS_STORE_NAME, JSON.stringify({ state: { islandDock: { edge: "middle", offset: 2 } }, version: 1 }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().islandDock).toEqual({ edge: "top", offset: 0.4 });
  });
});
