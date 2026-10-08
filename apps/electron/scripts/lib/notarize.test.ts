import { describe, expect, it } from "vitest";
import { planNotarization } from "./notarize.ts";

const API_KEY = { APPLE_API_KEY: "/keys/AuthKey.p8", APPLE_API_KEY_ID: "T9GPZ92M7K", APPLE_API_ISSUER: "c055ca8c" };
const APPLE_ID = { APPLE_ID: "dev@tesseract.dev", APPLE_APP_SPECIFIC_PASSWORD: "abcd-efgh", APPLE_TEAM_ID: "TEAM123" };

describe("planNotarization", () => {
  it("skips non-mac builds even with credentials", () => {
    expect(planNotarization(API_KEY, "linux")).toEqual({ notarize: false, reason: "not a macOS build (linux)" });
  });

  it("skips when no credentials are set", () => {
    expect(planNotarization({}, "darwin")).toMatchObject({ notarize: false });
  });

  it("skips when TESSERACT_NOTARIZE=0", () => {
    expect(planNotarization({ ...API_KEY, TESSERACT_NOTARIZE: "0" }, "darwin")).toMatchObject({ notarize: false });
  });

  it("prefers the App Store Connect API key", () => {
    expect(planNotarization({ ...APPLE_ID, ...API_KEY }, "darwin")).toEqual({
      notarize: true,
      method: "api-key",
      credentials: { appleApiKey: "/keys/AuthKey.p8", appleApiKeyId: "T9GPZ92M7K", appleApiIssuer: "c055ca8c" },
    });
  });

  it("uses Apple ID credentials", () => {
    expect(planNotarization(APPLE_ID, "darwin")).toEqual({
      notarize: true,
      method: "apple-id",
      credentials: { appleId: "dev@tesseract.dev", appleIdPassword: "abcd-efgh", teamId: "TEAM123" },
    });
  });

  it("uses a keychain profile", () => {
    expect(planNotarization({ APPLE_KEYCHAIN_PROFILE: "tesseract", APPLE_KEYCHAIN: "ci.keychain" }, "darwin")).toEqual({
      notarize: true,
      method: "keychain",
      credentials: { keychainProfile: "tesseract", keychain: "ci.keychain" },
    });
  });

  it("fails on a partial credential set instead of silently skipping", () => {
    expect(() => planNotarization({ APPLE_ID: "dev@tesseract.dev", APPLE_TEAM_ID: " " }, "darwin")).toThrow(
      /missing APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID/,
    );
  });

  it("fails when notarization is required but no credentials exist", () => {
    expect(() => planNotarization({ TESSERACT_NOTARIZE: "1" }, "darwin")).toThrow(/no credentials/);
  });
});
