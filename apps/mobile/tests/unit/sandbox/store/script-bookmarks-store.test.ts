import { useScriptBookmarksStore } from "@/features/sandbox/store/script-bookmarks-store";
import { SCRIPT_BOOKMARKS_STORE_NAME } from "@/features/sandbox/utils/constants";

import { __dump as dumpKvStore, __reset as resetKvStore, __seed as seedKvStore } from "../../../mocks/expo-sqlite-kv-store";

beforeEach(() => {
  resetKvStore();
  useScriptBookmarksStore.setState({ bookmarks: {} });
});

describe("useScriptBookmarksStore", () => {
  it("toggles and persists bookmarks per project", async () => {
    const { toggleBookmark } = useScriptBookmarksStore.getState();
    toggleBookmark("p1", "build");
    toggleBookmark("p1", "dev");
    toggleBookmark("p2", "test");
    toggleBookmark("p1", "build");
    expect(useScriptBookmarksStore.getState().bookmarks).toEqual({ p1: ["dev"], p2: ["test"] });
    await Promise.resolve();
    expect(JSON.parse(dumpKvStore()[SCRIPT_BOOKMARKS_STORE_NAME]).state).toEqual({
      bookmarks: { p1: ["dev"], p2: ["test"] },
    });
  });

  it("restores saved bookmarks and ignores malformed ones", async () => {
    seedKvStore(SCRIPT_BOOKMARKS_STORE_NAME, JSON.stringify({ state: { bookmarks: { p1: ["dev"] } }, version: 1 }));
    await useScriptBookmarksStore.persist.rehydrate();
    expect(useScriptBookmarksStore.getState().bookmarks).toEqual({ p1: ["dev"] });

    useScriptBookmarksStore.setState({ bookmarks: {} });
    seedKvStore(SCRIPT_BOOKMARKS_STORE_NAME, JSON.stringify({ state: { bookmarks: { p1: "dev" } }, version: 1 }));
    await useScriptBookmarksStore.persist.rehydrate();
    expect(useScriptBookmarksStore.getState().bookmarks).toEqual({});
  });
});
