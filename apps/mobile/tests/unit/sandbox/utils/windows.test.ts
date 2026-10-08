import type { DisplayWindow } from "@tesseract/protocol";

import { windowDetail, windowTitle } from "@/features/sandbox/utils/windows";

const base: DisplayWindow = { id: "0x1", title: "Hybrid POS", app: "electron", pid: 1, active: false, minimized: false };

describe("window labels", () => {
  it("falls back from the title to the app name", () => {
    expect(windowTitle(base)).toBe("Hybrid POS");
    expect(windowTitle({ ...base, title: "  " })).toBe("electron");
    expect(windowTitle({ ...base, title: "", app: null })).toBe("Untitled window");
  });

  it("describes the app and its state", () => {
    expect(windowDetail(base)).toBe("electron");
    expect(windowDetail({ ...base, active: true })).toBe("electron · Active");
    expect(windowDetail({ ...base, minimized: true, app: null })).toBe("Minimized");
  });
});
