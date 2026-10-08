import { selectHasPendingWork, useIslandStore } from "@/features/island/store/island-store";
import type { AttachDraft } from "@/features/island/types";

import type { SharedItem } from "@/modules/tesseract-island";

const DRAFT: AttachDraft = { text: "hello", files: [], source: "capture" };
const ITEM: SharedItem = {
  id: "shr_1",
  kind: "text",
  uri: null,
  text: "hi",
  name: "hi",
  mimeType: "text/plain",
  sizeBytes: null,
  createdAt: "2026-09-23T10:00:00.000Z",
};

const store = () => useIslandStore.getState();

beforeEach(() => store().reset());

describe("island store", () => {
  it("toggles the card and closes it when a flow opens", () => {
    store().toggleExpanded();
    expect(store().expanded).toBe(true);
    store().openCapture();
    expect(store()).toMatchObject({ expanded: false, captureOpen: true, captureSeed: null, attachOpen: false });
    store().closeCapture();
    expect(store().captureOpen).toBe(false);
  });

  it("stages a draft for the attach sheet and clears it on close", () => {
    store().openAttach(DRAFT);
    expect(store()).toMatchObject({ attachOpen: true, stagedDraft: DRAFT, captureOpen: false });
    store().closeAttach();
    expect(store()).toMatchObject({ attachOpen: false, stagedDraft: null });
  });

  it("queues shared items until they are taken", () => {
    store().queueSharedItems([]);
    expect(store().sharedItems).toEqual([]);
    store().queueSharedItems([ITEM]);
    store().queueSharedItems([{ ...ITEM, id: "shr_2" }]);
    expect(selectHasPendingWork(store())).toBe(true);
    expect(store().takeSharedItems().map((item) => item.id)).toEqual(["shr_1", "shr_2"]);
    expect(store().sharedItems).toEqual([]);
    expect(selectHasPendingWork(store())).toBe(false);
  });

  it("hands the pending draft out exactly once", () => {
    store().setPendingDraft(DRAFT);
    expect(selectHasPendingWork(store())).toBe(true);
    expect(store().takePendingDraft()).toEqual(DRAFT);
    expect(store().takePendingDraft()).toBeNull();
    expect(store().pendingDraft).toBeNull();
  });
});
