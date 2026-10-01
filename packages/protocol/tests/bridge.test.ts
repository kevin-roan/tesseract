import { describe, expect, test } from "bun:test";
import * as bridge from "../src/bridge";
import { INPUT_MODES, PAGE_MESSAGES, PAGE_STATES, VNC_ACTIONS } from "../src/index";

describe("page bridge contract", () => {
  test("is re-exported from the package root", () => {
    expect(PAGE_MESSAGES).toBe(bridge.PAGE_MESSAGES);
    expect(PAGE_STATES).toBe(bridge.PAGE_STATES);
  });

  test("message names are unique and page-prefixed", () => {
    const names = Object.values(PAGE_MESSAGES);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^(terminal-(state|need-ticket)|vnc-(state|need-ticket|action)|theone-[a-z-]+)$/);
    expect(PAGE_MESSAGES.reconnect).toBe("theone-reconnect");
    expect(PAGE_MESSAGES.inputMode).toBe("theone-input-mode");
    expect(PAGE_MESSAGES.insets).toBe("theone-insets");
    expect(PAGE_MESSAGES.vncAction).toBe("vnc-action");
    expect(INPUT_MODES).toEqual(["trackpad", "touch"]);
    expect(VNC_ACTIONS).toEqual(["browser"]);
  });

  test("the bridge module has no runtime dependency on zod", async () => {
    const source = await Bun.file(new URL("../src/bridge.ts", import.meta.url)).text();
    expect(source).not.toMatch(/^import /m);
    expect(PAGE_STATES).toEqual(["connecting", "connected", "disconnected", "exited", "error"]);
  });
});
