import { buildPairingLink } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { REMOTE_LABELS } from "./labels";
import { isPairingLink, remoteInput } from "./remote";

const TOKEN = "a".repeat(43);
const URL = "https://tesseract.example.ts.net";

describe("remoteInput", () => {
  it("reads a pairing link without a token field", () => {
    const link = buildPairingLink({ url: URL, token: TOKEN, name: "studio" });
    expect(isPairingLink(link)).toBe(true);
    expect(remoteInput(link, "")).toEqual({ ok: true, value: { apiUrl: URL, token: TOKEN, name: "studio", pairingUrl: URL } });
  });

  it("takes a URL and token", () => {
    expect(remoteInput(` ${URL} `, ` ${TOKEN} `)).toEqual({ ok: true, value: { apiUrl: URL, token: TOKEN, name: null, pairingUrl: null } });
  });

  it("asks for what is missing", () => {
    expect(remoteInput("", "")).toEqual({ ok: false, errors: { address: REMOTE_LABELS.addressMissing } });
    expect(remoteInput("tesseract.example", TOKEN)).toEqual({ ok: false, errors: { address: REMOTE_LABELS.invalidUrl } });
    expect(remoteInput(URL, "")).toEqual({ ok: false, errors: { token: REMOTE_LABELS.tokenMissing } });
  });

  it("rejects host shell links", () => {
    const result = remoteInput(buildPairingLink({ url: URL, token: TOKEN }, "host"), "");
    expect(result.ok).toBe(false);
  });
});
