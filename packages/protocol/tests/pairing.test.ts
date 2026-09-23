import { describe, expect, test } from "bun:test";
import {
  buildPairingLink,
  normalizeBaseUrl,
  parseBaseUrl,
  parsePairingLink,
  toWebSocketUrl,
  type BaseUrlErrorCode,
  type PairingErrorCode,
} from "../src/index";

const TOKEN = "q3Jx0mZ8yWv1_bT7-kLp2sR4nC6dE9fG0hI1jK2lM3n";

describe("pairing links", () => {
  test("round-trip with name", () => {
    const link = buildPairingLink({ url: "https://theone-sandbox.tail1234.ts.net/", token: TOKEN, name: "Home rig & co" });
    expect(link).toBe(
      `theone://pair?url=${encodeURIComponent("https://theone-sandbox.tail1234.ts.net")}&token=${TOKEN}&name=Home%20rig%20%26%20co`,
    );
    expect(parsePairingLink(link)).toEqual({
      ok: true,
      value: { url: "https://theone-sandbox.tail1234.ts.net", token: TOKEN, name: "Home rig & co" },
    });
  });

  test("round-trip without name omits the key", () => {
    const link = buildPairingLink({ url: "http://127.0.0.1:7700", token: TOKEN });
    expect(link).not.toContain("name=");
    const parsed = parsePairingLink(link);
    expect(parsed).toEqual({ ok: true, value: { url: "http://127.0.0.1:7700", token: TOKEN } });
  });

  test("tolerates whitespace, line breaks, case and triple slash", () => {
    const link = buildPairingLink({ url: "http://100.64.0.7:7700", token: TOKEN, name: "rig" });
    const messy = `  \n${link.slice(0, 20)}\r\n ${link.slice(20).replace("theone", "THEONE")}\t \n`;
    expect(parsePairingLink(messy)).toEqual({
      ok: true,
      value: { url: "http://100.64.0.7:7700", token: TOKEN, name: "rig" },
    });
    const tripleSlash = link.replace("theone://pair", "TheOne:///pair/");
    expect(parsePairingLink(tripleSlash).ok).toBe(true);
  });

  test("normalizes the embedded url", () => {
    const link = `theone://pair?url=${encodeURIComponent("HTTPS://Sandbox.Example.ts.net:443/v1/health?x=1")}&token=${TOKEN}`;
    const parsed = parsePairingLink(link);
    expect(parsed.ok && parsed.value.url).toBe("https://sandbox.example.ts.net");
  });

  const errorCases: Array<[string, PairingErrorCode]> = [
    ["", "empty"],
    ["   \n", "empty"],
    [`https://example.com/pair?url=x&token=${TOKEN}`, "invalid_scheme"],
    [`theone://connect?url=x&token=${TOKEN}`, "invalid_action"],
    [`theone://pair?token=${TOKEN}`, "missing_url"],
    [`theone://pair?url=ftp%3A%2F%2Fhost&token=${TOKEN}`, "invalid_url"],
    [`theone://pair?url=%E0%A4%A&token=${TOKEN}`, "missing_url"],
    ["theone://pair?url=http%3A%2F%2Fhost%3A7700", "missing_token"],
    ["theone://pair?url=http%3A%2F%2Fhost%3A7700&token=", "missing_token"],
    ["theone://pair?url=http%3A%2F%2Fhost%3A7700&token=%E2%9C%93", "invalid_token"],
  ];
  for (const [input, code] of errorCases) {
    test(`rejects ${JSON.stringify(input)} with ${code}`, () => {
      const result = parsePairingLink(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(code);
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    });
  }

  test("buildPairingLink rejects unusable input", () => {
    expect(() => buildPairingLink({ url: "sandbox:7700", token: TOKEN })).toThrow(TypeError);
    expect(() => buildPairingLink({ url: "http://sandbox:7700", token: "has space" })).toThrow(TypeError);
  });

  test("long names are capped", () => {
    const link = buildPairingLink({ url: "http://h:1", token: TOKEN, name: "x".repeat(200) });
    const parsed = parsePairingLink(link);
    expect(parsed.ok && parsed.value.name?.length).toBe(64);
  });
});

describe("base urls", () => {
  const valid: Array<[string, string]> = [
    ["https://theone-sandbox.tail1234.ts.net/", "https://theone-sandbox.tail1234.ts.net"],
    ["  http://127.0.0.1:7700//  ", "http://127.0.0.1:7700"],
    ["http://localhost:80/", "http://localhost"],
    ["https://host:8443/v1/health?x=1#frag", "https://host:8443"],
    ["https://host/ui/vnc#ticket=abc", "https://host"],
    ["https://host/proxy/theone/v1", "https://host/proxy/theone"],
    ["https://host/videos", "https://host/videos"],
    ["http://[::1]:7700/", "http://[::1]:7700"],
    ["http://sandbox:07700", "http://sandbox:7700"],
    ["http://sandbox:", "http://sandbox"],
    ["HTTP://Theone-Sandbox.", "http://theone-sandbox"],
  ];
  for (const [input, expected] of valid) {
    test(`normalizes ${JSON.stringify(input)}`, () => {
      expect(normalizeBaseUrl(input)).toBe(expected);
    });
  }

  const invalid: Array<[string, BaseUrlErrorCode]> = [
    ["", "empty"],
    ["sandbox:7700", "unsupported_scheme"],
    ["100.64.0.1:7700", "unsupported_scheme"],
    ["ws://host", "unsupported_scheme"],
    ["https://user:pass@host", "credentials_not_allowed"],
    ["https://", "invalid_host"],
    ["https://bad host", "invalid_host"],
    ["https://host:99999", "invalid_port"],
    ["https://host:abc", "invalid_port"],
  ];
  for (const [input, code] of invalid) {
    test(`rejects ${JSON.stringify(input)} with ${code}`, () => {
      const result = parseBaseUrl(input);
      expect(result.ok ? null : result.error.code).toBe(code);
      expect(normalizeBaseUrl(input)).toBeNull();
    });
  }

  test("toWebSocketUrl", () => {
    expect(toWebSocketUrl("https://host/prefix")).toBe("wss://host/prefix");
    expect(toWebSocketUrl("http://127.0.0.1:7700")).toBe("ws://127.0.0.1:7700");
  });
});
