import { describe, expect, test } from "bun:test";
import {
  AGENT_RUN_STATES,
  appendQuery,
  buildFragment,
  buildPairingLink,
  BUILD_STATES,
  createId,
  ERROR_CODES,
  ERROR_STATUS,
  errorBody,
  errorCodeForStatus,
  FINAL_AGENT_RUN_STATES,
  FINAL_BUILD_STATES,
  FINAL_PROCESS_STATES,
  ID_PREFIXES,
  idPattern,
  isErrorCode,
  isFinalAgentRunState,
  isFinalBuildState,
  isFinalProcessState,
  isIdOfKind,
  isValidToken,
  LIMITS,
  normalizeProjectId,
  PAGE_MESSAGES,
  PAGE_STATES,
  parseBaseUrl,
  parseJsonWith,
  parseParams,
  parsePairingLink,
  PROCESS_STATES,
  projectIdFromName,
  statusForErrorCode,
  toWebSocketUrl,
  validate,
  HealthSchema,
  type BaseUrlErrorCode,
  type ErrorCode,
  type IdKind,
} from "../src/index";

const TOKEN = "tok_abc-123";

describe("parseBaseUrl edge cases", () => {
  const valid: Array<[string, string]> = [
    ["http://[::1]", "http://[::1]"],
    ["http://[::FFFF:1.2.3.4]:1/", "http://[::ffff:1.2.3.4]:1"],
    ["https://host:443", "https://host"],
    ["https://host:80", "https://host:80"],
    ["http://host:443", "http://host:443"],
    ["http://host:0443", "http://host:443"],
    ["http://host:1", "http://host:1"],
    ["http://host:65535", "http://host:65535"],
    ["https://host/prefix/v2/x/y", "https://host/prefix"],
    ["https://host/prefix/V1", "https://host/prefix"],
    ["https://host/v1beta", "https://host/v1beta"],
    ["https://host/uix", "https://host/uix"],
    ["https://host?x=1", "https://host"],
    ["https://host#frag", "https://host"],
    ["https://sub_domain.example.com", "https://sub_domain.example.com"],
    ["\thttps://host\n", "https://host"],
  ];
  for (const [input, expected] of valid) {
    test(`normalizes ${JSON.stringify(input)}`, () => {
      const result = parseBaseUrl(input);
      expect(result).toEqual({ ok: true, value: expected });
    });
  }

  const invalid: Array<[string, BaseUrlErrorCode]> = [
    ["   ", "empty"],
    ["ftp://host", "unsupported_scheme"],
    ["javascript://host", "unsupported_scheme"],
    ["//host", "unsupported_scheme"],
    ["https://@host", "credentials_not_allowed"],
    ["https://-host", "invalid_host"],
    ["https://a..b", "invalid_host"],
    ["https://host\\evil.com", "invalid_host"],
    ["https://[zz]", "invalid_host"],
    ["https://[::1]x", "invalid_host"],
    ["https://host:80:90", "invalid_host"],
    ["https://" + "a".repeat(64), "invalid_host"],
    ["https://host:0", "invalid_port"],
    ["https://host:65536", "invalid_port"],
    ["https://host:-1", "invalid_port"],
    ["https://host:1e3", "invalid_port"],
    ["https://host/a b", "invalid_path"],
    ["https://host/a\tb", "invalid_path"],
    ["https://host/a\u0000", "invalid_path"],
    ["https://host/a\\b", "invalid_path"],
  ];
  for (const [input, code] of invalid) {
    test(`rejects ${JSON.stringify(input)} with ${code}`, () => {
      const result = parseBaseUrl(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(code);
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    });
  }

  test("accepts a host of exactly 63-character labels", () => {
    const label = "a".repeat(63);
    expect(parseBaseUrl(`https://${label}.${label}`).ok).toBe(true);
  });

  test("toWebSocketUrl is case-insensitive and passes other schemes through", () => {
    expect(toWebSocketUrl("HTTPS://host")).toBe("wss://host");
    expect(toWebSocketUrl("HTTP://host")).toBe("ws://host");
    expect(toWebSocketUrl("ws://already")).toBe("ws://already");
    expect(toWebSocketUrl("")).toBe("");
  });
});

describe("query helpers", () => {
  test("appendQuery keeps a fragment after the query", () => {
    expect(appendQuery("/a#frag", { b: 2 })).toBe("/a?b=2#frag");
    expect(appendQuery("/a?x=1#frag", { b: 2 })).toBe("/a?x=1&b=2#frag");
    expect(appendQuery("/a#frag?no", { b: 2 })).toBe("/a?b=2#frag?no");
    expect(appendQuery("/a", undefined)).toBe("/a");
    expect(appendQuery("/a", { skipped: null, gone: undefined })).toBe("/a");
  });

  test("values are stringified and encoded", () => {
    expect(appendQuery("/a", { n: 0, f: false, s: "a&b=c" })).toBe("/a?n=0&f=false&s=a%26b%3Dc");
    expect(buildFragment({ "k y": "v/w" })).toBe("#k%20y=v%2Fw");
    expect(buildFragment()).toBe("");
  });

  test("parseParams edge cases", () => {
    expect(parseParams("")).toEqual({});
    expect(parseParams("?")).toEqual({});
    expect(parseParams("#")).toEqual({});
    expect(parseParams("a=1&a=2")).toEqual({ a: "1" });
    expect(parseParams("bad=%E0%A4%A&ok=1")).toEqual({ ok: "1" });
    expect(parseParams("%ZZ=1&k=2")).toEqual({ k: "2" });
    expect(parseParams("flag&&x=")).toEqual({ flag: "", x: "" });
    expect(parseParams("d=a=b")).toEqual({ d: "a=b" });
    expect(parseParams("plus=a+b")).toEqual({ plus: "a+b" });
    expect(parseParams("?%61=%62")).toEqual({ a: "b" });
  });

  test("parseParams keeps keys named like Object.prototype members as own data", () => {
    const result = parseParams("toString=1&constructor=2&__proto__=3&hasOwnProperty=4");
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.keys(result)).toEqual(["toString", "constructor", "__proto__", "hasOwnProperty"]);
    expect(Object.getOwnPropertyDescriptor(result, "toString")?.value).toBe("1");
    expect(Object.getOwnPropertyDescriptor(result, "__proto__")?.value).toBe("3");
    expect(parseParams("__proto__=a&__proto__=b")["__proto__"]).toBe("a");
  });
});

describe("pairing edge cases", () => {
  test("token boundaries", () => {
    expect(isValidToken("x")).toBe(true);
    expect(isValidToken("~".repeat(1024))).toBe(true);
    expect(isValidToken("x".repeat(1025))).toBe(false);
    expect(isValidToken("")).toBe(false);
    expect(isValidToken("a b")).toBe(false);
    expect(isValidToken("a\u007f")).toBe(false);
    expect(isValidToken("é")).toBe(false);
  });

  test("names with reserved characters round-trip", () => {
    const name = "Kevin's box & co = #1 / ü";
    const link = buildPairingLink({ url: "https://host", token: TOKEN, name });
    expect(parsePairingLink(link)).toEqual({ ok: true, value: { url: "https://host", token: TOKEN, name } });
  });

  test("tokens with reserved characters round-trip", () => {
    const token = "a+b/c=d&e#f%g";
    const link = buildPairingLink({ url: "https://host", token });
    expect(parsePairingLink(link)).toEqual({ ok: true, value: { url: "https://host", token } });
  });

  test("blank names are dropped on both sides", () => {
    expect(buildPairingLink({ url: "https://host", token: TOKEN, name: "   " })).not.toContain("name=");
    const parsed = parsePairingLink(`theone://pair?url=https%3A%2F%2Fhost&token=${TOKEN}&name=%20%20`);
    expect(parsed).toEqual({ ok: true, value: { url: "https://host", token: TOKEN } });
  });

  test("names are trimmed after capping", () => {
    const name = `${"n".repeat(LIMITS.maxPairingNameLength - 1)} tail`;
    const parsed = parsePairingLink(buildPairingLink({ url: "https://host", token: TOKEN, name }));
    expect(parsed.ok && parsed.value.name).toBe("n".repeat(LIMITS.maxPairingNameLength - 1));
  });

  test("the first url/token wins and fragments are ignored", () => {
    const parsed = parsePairingLink(
      `theone://pair/?url=https%3A%2F%2Fgood&token=${TOKEN}&url=https%3A%2F%2Fevil&token=other#url=https://x`,
    );
    expect(parsed).toEqual({ ok: true, value: { url: "https://good", token: TOKEN } });
  });

  test("malformed links", () => {
    const code = (input: string) => {
      const parsed = parsePairingLink(input);
      return parsed.ok ? null : parsed.error.code;
    };
    expect(code("theone:pair?url=https://h&token=t")).toBe("invalid_action");
    expect(code("theone://pairing?url=https://h&token=t")).toBe("invalid_action");
    expect(code("theone://pair")).toBe("missing_url");
    expect(code("theone://pair?url=&token=t")).toBe("missing_url");
    expect(code("theone://pair?url=https%3A%2F%2Fh%3A0&token=t")).toBe("invalid_url");
    expect(code("theone://pair?url=https://h&token=")).toBe("missing_token");
    expect(code(`theone://pair?url=https://h&token=${"x".repeat(1025)}`)).toBe("invalid_token");
    expect(code("theone://pair?url=https://h&token=%01")).toBe("invalid_token");
    expect(code("http://pair?url=https://h&token=t")).toBe("invalid_scheme");
  });

  test("buildPairingLink error messages", () => {
    expect(() => buildPairingLink({ url: "ftp://x", token: TOKEN })).toThrow(/Invalid pairing url/);
    expect(() => buildPairingLink({ url: "https://x", token: "" })).toThrow("Invalid pairing token");
  });
});

describe("ids", () => {
  const kinds = Object.keys(ID_PREFIXES) as IdKind[];

  test("createId uses the prefix and the unambiguous alphabet", () => {
    for (const kind of kinds) {
      for (let i = 0; i < 50; i += 1) {
        const id = createId(kind);
        expect(id).toMatch(new RegExp(`^${ID_PREFIXES[kind]}[0-9abcdefghjkmnpqrstvwxyz]{10}$`));
        expect(isIdOfKind(kind, id)).toBe(true);
      }
    }
  });

  test("createId is not repeated", () => {
    const ids = new Set(Array.from({ length: 500 }, () => createId("process")));
    expect(ids.size).toBe(500);
  });

  test("id patterns reject other kinds and bad suffixes", () => {
    expect(isIdOfKind("build", "prc_abc")).toBe(false);
    expect(isIdOfKind("build", "bld_")).toBe(false);
    expect(isIdOfKind("build", `bld_${"a".repeat(64)}`)).toBe(true);
    expect(isIdOfKind("build", `bld_${"a".repeat(65)}`)).toBe(false);
    expect(isIdOfKind("build", "bld_a/b")).toBe(false);
    expect(isIdOfKind("build", " bld_a")).toBe(false);
    expect(idPattern("artifact").source.startsWith("^art_")).toBe(true);
  });

  test("normalizeProjectId trims and lowercases", () => {
    expect(normalizeProjectId("  My-App  ")).toBe("my-app");
    expect(normalizeProjectId("")).toBeNull();
    expect(normalizeProjectId("-lead")).toBeNull();
    expect(normalizeProjectId("a/b")).toBeNull();
    expect(normalizeProjectId("x".repeat(65))).toBeNull();
  });

  test("projectIdFromName slug edge cases", () => {
    expect(projectIdFromName("  --Hello World!!.. ")).toBe("hello-world");
    expect(projectIdFromName(`${"a".repeat(63)}-b`)).toBe("a".repeat(63));
    expect(projectIdFromName("x".repeat(80))).toBe("x".repeat(64));
    expect(projectIdFromName("日本")).toBeNull();
    expect(projectIdFromName("")).toBeNull();
    expect(projectIdFromName("...")).toBeNull();
    expect(projectIdFromName("v1.2_beta")).toBe("v1.2_beta");
  });
});

describe("states and errors", () => {
  test("final state predicates match the constant lists", () => {
    for (const state of PROCESS_STATES) {
      expect(isFinalProcessState(state)).toBe((FINAL_PROCESS_STATES as readonly string[]).includes(state));
    }
    for (const state of BUILD_STATES) {
      expect(isFinalBuildState(state)).toBe((FINAL_BUILD_STATES as readonly string[]).includes(state));
    }
    for (const state of AGENT_RUN_STATES) {
      expect(isFinalAgentRunState(state)).toBe((FINAL_AGENT_RUN_STATES as readonly string[]).includes(state));
    }
  });

  test("isErrorCode", () => {
    for (const code of ERROR_CODES) expect(isErrorCode(code)).toBe(true);
    expect(isErrorCode("teapot")).toBe(false);
    expect(isErrorCode("")).toBe(false);
    expect(isErrorCode("toString")).toBe(false);
  });

  test("errorCodeForStatus covers every range", () => {
    const table: Array<[number, ErrorCode]> = [
      [0, "internal"],
      [200, "internal"],
      [399, "internal"],
      [400, "bad_request"],
      [401, "unauthorized"],
      [403, "forbidden"],
      [404, "not_found"],
      [409, "conflict"],
      [413, "bad_request"],
      [429, "bad_request"],
      [499, "bad_request"],
      [500, "internal"],
      [501, "internal"],
      [502, "unavailable"],
      [503, "unavailable"],
      [504, "unavailable"],
      [505, "internal"],
    ];
    for (const [status, code] of table) expect([status, errorCodeForStatus(status)]).toEqual([status, code]);
  });

  test("status and code mappings agree", () => {
    for (const code of ERROR_CODES) {
      expect(statusForErrorCode(code)).toBe(ERROR_STATUS[code]);
      expect(errorCodeForStatus(statusForErrorCode(code))).toBe(code);
      expect(errorBody(code, "m")).toEqual({ error: { code, message: "m" } });
    }
  });
});

describe("validation helpers", () => {
  test("validate reports every failing field", () => {
    const result = validate(HealthSchema, { ok: false, protocolVersion: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_payload");
      expect(result.error.message).toContain("version");
      expect(result.error.message).toContain("sandboxId");
    }
  });

  test("parseJsonWith distinguishes syntax from shape errors", () => {
    const syntax = parseJsonWith(HealthSchema, "{");
    expect(syntax.ok ? null : syntax.error.code).toBe("invalid_json");
    const shape = parseJsonWith(HealthSchema, "null");
    expect(shape.ok ? null : shape.error.code).toBe("invalid_payload");
    const empty = parseJsonWith(HealthSchema, "");
    expect(empty.ok ? null : empty.error.code).toBe("invalid_json");
  });
});

describe("bridge", () => {
  test("page states are unique", () => {
    expect(new Set(PAGE_STATES).size).toBe(PAGE_STATES.length);
    expect(new Set(Object.values(PAGE_MESSAGES)).size).toBe(Object.values(PAGE_MESSAGES).length);
  });
});
