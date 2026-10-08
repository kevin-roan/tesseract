import { afterEach, describe, expect, it, vi } from "vitest";
import afterSign, { type AfterSignContext } from "./after-sign.ts";

function context(platform: string): AfterSignContext {
  return { electronPlatformName: platform, appOutDir: "/tmp/mac-universal", packager: { appInfo: { productFilename: "Tesseract" } } };
}

describe("afterSign hook", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does nothing outside macOS", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const notarize = vi.fn();
    expect(await afterSign(context("linux"), async () => notarize)).toBe("skipped");
    expect(notarize).not.toHaveBeenCalled();
  });

  it("notarizes the signed .app with credentials from the environment", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("TESSERACT_NOTARIZE", undefined);
    vi.stubEnv("APPLE_API_KEY", "/keys/AuthKey.p8");
    vi.stubEnv("APPLE_API_KEY_ID", "KEYID");
    vi.stubEnv("APPLE_API_ISSUER", "ISSUER");
    const notarize = vi.fn(async () => undefined);
    expect(await afterSign(context("darwin"), async () => notarize)).toBe("/tmp/mac-universal/Tesseract.app");
    expect(notarize).toHaveBeenCalledWith({
      appPath: "/tmp/mac-universal/Tesseract.app",
      appleApiKey: "/keys/AuthKey.p8",
      appleApiKeyId: "KEYID",
      appleApiIssuer: "ISSUER",
    });
  });
});
