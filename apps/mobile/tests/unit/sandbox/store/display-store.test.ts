import { useDisplayStore } from "@/features/sandbox/store/display-store";
import { DISPLAY_STORE_NAME } from "@/features/sandbox/utils/constants";

import { __dump as dumpKvStore, __reset as resetKvStore, __seed as seedKvStore } from "../../../mocks/expo-sqlite-kv-store";

const saved = (inputMode: string) => JSON.stringify({ state: { inputMode }, version: 1 });

beforeEach(() => {
  resetKvStore();
  useDisplayStore.setState({ inputMode: "trackpad" });
});

describe("useDisplayStore", () => {
  it("persists the chosen input mode", async () => {
    useDisplayStore.getState().setInputMode("touch");
    expect(useDisplayStore.getState().inputMode).toBe("touch");
    await Promise.resolve();
    expect(JSON.parse(dumpKvStore()[DISPLAY_STORE_NAME]).state).toEqual({ inputMode: "touch" });
  });

  it("restores a saved mode and ignores an unknown one", async () => {
    seedKvStore(DISPLAY_STORE_NAME, saved("touch"));
    await useDisplayStore.persist.rehydrate();
    expect(useDisplayStore.getState().inputMode).toBe("touch");

    useDisplayStore.setState({ inputMode: "trackpad" });
    seedKvStore(DISPLAY_STORE_NAME, saved("stylus"));
    await useDisplayStore.persist.rehydrate();
    expect(useDisplayStore.getState().inputMode).toBe("trackpad");
  });
});
