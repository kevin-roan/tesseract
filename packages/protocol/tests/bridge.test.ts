import { describe, expect, test } from "bun:test";
import * as bridge from "../src/bridge";
import { PAGE_MESSAGES, PAGE_STATES } from "../src/index";

describe("page bridge contract", () => {
  test("is re-exported from the package root", () => {
    expect(PAGE_MESSAGES).toBe(bridge.PAGE_MESSAGES);
    expect(PAGE_STATES).toBe(bridge.PAGE_STATES);
  });

  test("message names are unique and page-prefixed", () => {
    const names = Object.values(PAGE_MESSAGES);
    expect(new Set(names).size).toBe(names.length);
    for (const [key, name] of Object.entries(PAGE_MESSAGES)) {
      if (key === "reconnect") expect(name).toBe("theone-reconnect");
      else expect(name).toMatch(/^(terminal|vnc)-(state|need-ticket)$/);
    }
  });

  test("the bridge module has no runtime dependency on zod", async () => {
    const source = await Bun.file(new URL("../src/bridge.ts", import.meta.url)).text();
    expect(source).not.toMatch(/^import /m);
    expect(PAGE_STATES).toEqual(["connecting", "connected", "disconnected", "exited", "error"]);
  });
});
