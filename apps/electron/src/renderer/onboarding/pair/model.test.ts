import { describe, expect, it } from "vitest";
import { FIXTURE_LOCAL_PAIR, FIXTURE_PAIR } from "../../fixtures/onboarding-final/data";
import { pairView } from "./model";

describe("pairView", () => {
  it("is ready with a caption when the link is known", () => {
    expect(pairView(FIXTURE_PAIR, null, false)).toEqual({
      kind: "ready",
      link: FIXTURE_PAIR.link,
      local: false,
      caption: "Sandbox tesseract-sandbox · https://tesseract-sandbox.tail1234.ts.net",
    });
  });

  it("falls back to the URL without a name and keeps local mode", () => {
    const view = pairView({ ...FIXTURE_LOCAL_PAIR, name: null }, null, false);
    expect(view).toMatchObject({
      kind: "ready",
      local: true,
      caption: "http://127.0.0.1:7700",
    });
  });

  it("reports errors once loading stops", () => {
    expect(pairView(null, "boom", false)).toEqual({
      kind: "error",
      message: "Can't build a pairing link: boom",
    });
    expect(pairView(null, "boom", true)).toEqual({ kind: "loading" });
    expect(pairView(null, null, false)).toEqual({ kind: "loading" });
  });
});
