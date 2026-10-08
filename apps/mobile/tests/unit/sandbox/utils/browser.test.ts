import type { BrowserTab } from "@tesseract/protocol";

import { browserSummary, tabShare, tabTitle } from "@/features/sandbox/utils/browser";

const VITE: BrowserTab = { id: "a", title: "Vite App", url: "http://localhost:5173/", phoneUrl: "http://100.64.0.1:5173/" };
const LOCAL_ONLY: BrowserTab = { id: "b", title: "", url: "http://localhost:3000/", phoneUrl: null };

describe("browserSummary", () => {
  it("explains a Chromium without remote debugging", () => {
    expect(browserSummary({ available: false, tabs: [VITE] })).toEqual({ kind: "unavailable" });
  });

  it("reports no tabs", () => {
    expect(browserSummary({ available: true, tabs: [] })).toEqual({ kind: "empty" });
  });

  it("treats the first tab as the current one", () => {
    expect(browserSummary({ available: true, tabs: [VITE, LOCAL_ONLY] })).toEqual({
      kind: "tabs",
      current: VITE,
      others: [LOCAL_ONLY],
    });
  });
});

describe("tabTitle", () => {
  it("falls back to the URL for an untitled page", () => {
    expect(tabTitle(VITE)).toBe("Vite App");
    expect(tabTitle({ ...LOCAL_ONLY, title: "  " })).toBe("http://localhost:3000/");
  });
});

describe("tabShare", () => {
  it("shares the phone-reachable URL with the page title", () => {
    expect(tabShare(VITE)).toEqual({ title: "Vite App", url: VITE.phoneUrl, message: "Vite App\nhttp://100.64.0.1:5173/" });
  });

  it("does not repeat the URL when the page has no title", () => {
    const untitled = { ...VITE, title: "", url: VITE.phoneUrl as string };
    expect(tabShare(untitled)?.message).toBe(VITE.phoneUrl);
  });

  it("has nothing to share when the phone can't reach the page", () => {
    expect(tabShare(LOCAL_ONLY)).toBeNull();
  });
});
