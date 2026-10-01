import { buildPairingLink } from "@theone/protocol";

import {
  draftFromSearchParams,
  fallbackSandboxName,
  isPairingLink,
  parsePairingText,
  validatePairingDraft,
} from "@/features/sandbox/utils/pairing";

const TOKEN = "q1W2e3R4t5Y6u7I8o9P0a1S2d3F4g5H6j7K8l9Z0x1C";

describe("validatePairingDraft", () => {
  it("normalizes a valid draft", () => {
    const result = validatePairingDraft({
      url: " https://theone-sandbox.tail1234.ts.net/v1/ ",
      token: ` ${TOKEN} `,
      name: "  Laptop sandbox ",
    });

    expect(result).toEqual({
      ok: true,
      value: { baseUrl: "https://theone-sandbox.tail1234.ts.net", token: TOKEN, name: "Laptop sandbox" },
    });
  });

  it("reports every invalid field at once", () => {
    const result = validatePairingDraft({ url: "", token: "", name: "x".repeat(80) });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({
      url: "Enter the controller URL.",
      token: "Enter the pairing token.",
      name: "Keep the name under 64 characters.",
    });
  });

  it("rejects unsupported schemes and tokens with spaces", () => {
    const result = validatePairingDraft({ url: "ftp://host", token: "has space", name: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.url).toMatch(/http/);
    expect(result.errors.token).toMatch(/not allowed/);
  });
});

describe("pairing links", () => {
  const link = buildPairingLink({ url: "http://100.64.0.7:7700", token: TOKEN, name: "Studio" });

  it("parses a link printed by the controller", () => {
    expect(parsePairingText(link)).toEqual({
      ok: true,
      draft: { url: "http://100.64.0.7:7700", token: TOKEN, name: "Studio" },
    });
  });

  it("explains codes that are not Monolith links", () => {
    const result = parsePairingText("https://example.com");
    expect(result).toEqual({ ok: false, message: expect.stringContaining("theone://pair") });
  });

  it("surfaces protocol errors for broken links", () => {
    const result = parsePairingText("theone://pair?url=http%3A%2F%2Fhost");
    expect(result).toEqual({ ok: false, message: "Pairing link has no token" });
  });

  it("detects pasted links", () => {
    expect(isPairingLink(`  ${link}`)).toBe(true);
    expect(isPairingLink("THEONE://pair?url=x")).toBe(true);
    expect(isPairingLink("https://host")).toBe(false);
  });
});

describe("draftFromSearchParams", () => {
  it("builds a draft from deep link params", () => {
    expect(draftFromSearchParams({ url: "https://host", token: TOKEN, name: ["Box", "ignored"] })).toEqual({
      url: "https://host",
      token: TOKEN,
      name: "Box",
    });
  });

  it("returns null when the route was opened without pairing data", () => {
    expect(draftFromSearchParams({})).toBeNull();
    expect(draftFromSearchParams({ name: "only a name" })).toBeNull();
  });
});

describe("fallbackSandboxName", () => {
  it("prefers the typed name, then the sandbox id, then the hostname", () => {
    expect(fallbackSandboxName(" Mine ", "theone-sandbox", "sandbox")).toBe("Mine");
    expect(fallbackSandboxName("", "theone-sandbox", "sandbox")).toBe("theone-sandbox");
    expect(fallbackSandboxName("", "", "sandbox")).toBe("sandbox");
    expect(fallbackSandboxName("", "", "")).toBe("Sandbox");
  });
});
