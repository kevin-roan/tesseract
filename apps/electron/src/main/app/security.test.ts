import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: {}, session: {}, shell: {} }));

const { externalUrl, isInternalUrl } = await import("./security");

describe("isInternalUrl", () => {
  const entry = "file:///opt/Tesseract/resources/app.asar/out/renderer/index.html";

  it("allows the packaged renderer entry and the dev server origin", () => {
    expect(isInternalUrl(`${entry}#/agents`, undefined, entry)).toBe(true);
    expect(isInternalUrl(entry, undefined, entry)).toBe(true);
    expect(isInternalUrl("http://127.0.0.1:4545/#/overview", "http://127.0.0.1:4545", entry)).toBe(true);
  });

  it("blocks other local files, including dropped ones", () => {
    expect(isInternalUrl("file:///home/me/Downloads/evil.html", undefined, entry)).toBe(false);
    expect(isInternalUrl("file:///opt/Tesseract/resources/app.asar/out/renderer/other.html", undefined, entry)).toBe(false);
    expect(isInternalUrl(`${entry}#/agents`, "http://127.0.0.1:4545", entry)).toBe(false);
  });

  it("blocks everything else", () => {
    expect(isInternalUrl("http://127.0.0.1:4545/", undefined, entry)).toBe(false);
    expect(isInternalUrl("https://example.com", "http://127.0.0.1:4545", entry)).toBe(false);
    expect(isInternalUrl("garbage", "http://127.0.0.1:4545", entry)).toBe(false);
  });
});

describe("externalUrl", () => {
  it("only passes http, https and mailto links", () => {
    expect(externalUrl("https://docs.docker.com/")).toBe("https://docs.docker.com/");
    expect(externalUrl("mailto:desk@tesseract.dev")).toBe("mailto:desk@tesseract.dev");
    expect(externalUrl("file:///etc/passwd")).toBeNull();
    expect(externalUrl("javascript:alert(1)")).toBeNull();
    expect(externalUrl("nope")).toBeNull();
  });
});
