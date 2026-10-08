import { INPUT_MODES, PAGE_MESSAGES, PAGE_STATES, VNC_ACTIONS } from "@tesseract/protocol";

import {
  inputModeMessage,
  inputModeScript,
  insetsMessage,
  insetsScript,
  pasteMessage,
  pasteScript,
  isDroppedPageState,
  pageConnectionFor,
  parsePageMessage,
  reconnectMessage,
  reconnectScript,
} from "@/features/sandbox/utils/web-bridge";

describe("parsePageMessage", () => {
  it("reads the Android screen page's messages", () => {
    expect(parsePageMessage({ type: "android-state", state: "connected" }, "android")).toEqual({
      page: "android",
      kind: "state",
      state: "connected",
    });
    expect(parsePageMessage({ type: "android-need-ticket" }, "android")).toEqual({ page: "android", kind: "need-ticket" });
    expect(parsePageMessage({ type: "vnc-state", state: "connected" }, "android")).toBeNull();
    expect(parsePageMessage({ type: "android-state", state: "error" }, "android")).toEqual({ page: "android", kind: "state", state: "error" });
  });

  it("parses state, ticket and exit messages from the controller pages", () => {
    expect(parsePageMessage(JSON.stringify({ type: "vnc-state", state: "connected" }))).toEqual({
      page: "vnc",
      kind: "state",
      state: "connected",
    });
    expect(parsePageMessage('{"type":"vnc-need-ticket"}')).toEqual({ page: "vnc", kind: "need-ticket" });
    expect(parsePageMessage({ type: "terminal-exit", code: 0 })).toEqual({ page: "terminal", kind: "exit", code: 0 });
    expect(parsePageMessage({ type: "terminal-exit" })).toEqual({ page: "terminal", kind: "exit", code: null });
  });

  it("treats the terminal page's exited state as an exit with its code", () => {
    expect(parsePageMessage({ type: "terminal-state", state: "exited", code: 130 })).toEqual({
      page: "terminal",
      kind: "exit",
      code: 130,
    });
  });

  it("accepts the controller's need-ticket payload with extra fields", () => {
    expect(parsePageMessage({ type: "terminal-need-ticket", session: "trm_1" })).toEqual({
      page: "terminal",
      kind: "need-ticket",
    });
  });

  it("accepts ':' and '.' separators", () => {
    expect(parsePageMessage({ type: "terminal:need-ticket" })).toEqual({ page: "terminal", kind: "need-ticket" });
    expect(parsePageMessage({ type: "vnc.state", state: "disconnected" })?.kind).toBe("state");
  });

  it("filters by the expected page", () => {
    expect(parsePageMessage({ type: "vnc-need-ticket" }, "terminal")).toBeNull();
    expect(parsePageMessage({ type: "vnc-need-ticket" }, "vnc")).not.toBeNull();
  });

  it("ignores anything else", () => {
    expect(parsePageMessage("not json")).toBeNull();
    expect(parsePageMessage("[1,2]")).toBeNull();
    expect(parsePageMessage({ type: "vnc-state" })).toBeNull();
    expect(parsePageMessage({ type: "other" })).toBeNull();
    expect(parsePageMessage(null)).toBeNull();
  });
});

describe("parsePageMessage actions", () => {
  it("parses the VNC page's browser action", () => {
    expect(parsePageMessage({ type: PAGE_MESSAGES.vncAction, action: "browser" }, "vnc")).toEqual({
      page: "vnc",
      kind: "action",
      action: "browser",
    });
    expect(parsePageMessage('{"type":"vnc:action","action":"browser"}')?.kind).toBe("action");
  });

  it("drops unknown or missing actions", () => {
    expect(parsePageMessage({ type: "vnc-action", action: "explode" })).toBeNull();
    expect(parsePageMessage({ type: "vnc-action" })).toBeNull();
    expect(parsePageMessage({ type: "vnc-action", action: "browser" }, "terminal")).toBeNull();
  });

  it("understands every action the pages post", () => {
    for (const action of VNC_ACTIONS) {
      expect(parsePageMessage({ type: PAGE_MESSAGES.vncAction, action })).toEqual({ page: "vnc", kind: "action", action });
    }
  });
});

describe("page bridge calls", () => {
  it("sets the insets and the input mode through window.tesseract when the page has them", () => {
    const setInsets = jest.fn();
    const setInputMode = jest.fn();
    new Function("window", insetsScript({ top: 64, bottom: 34 }))({ tesseract: { setInsets } });
    new Function("window", inputModeScript("touch"))({ tesseract: { setInputMode } });
    expect(setInsets).toHaveBeenCalledWith({ top: 64, bottom: 34 });
    expect(setInputMode).toHaveBeenCalledWith("touch");
  });

  it("does nothing on a page without the bridge", () => {
    for (const script of [insetsScript({ top: 0, bottom: 0 }), inputModeScript("trackpad"), pasteScript("x")]) {
      expect(script.endsWith("true;")).toBe(true);
      expect(() => new Function("window", script)({})).not.toThrow();
      expect(() => new Function("window", script)({ tesseract: {} })).not.toThrow();
    }
  });

  it("pastes text through window.tesseract, quoting it safely", () => {
    const paste = jest.fn();
    const text = 'https://x.dev/?q="a"</script>\n';
    new Function("window", pasteScript(text))({ tesseract: { paste } });
    expect(paste).toHaveBeenCalledWith(text);
    expect(pasteMessage(text)).toEqual({ type: PAGE_MESSAGES.paste, text });
  });

  it("frames the postMessage fallbacks the pages listen for", () => {
    expect(insetsMessage({ top: 60, bottom: 20 })).toEqual({ type: PAGE_MESSAGES.insets, top: 60, bottom: 20 });
    for (const mode of INPUT_MODES) {
      expect(inputModeMessage(mode)).toEqual({ type: PAGE_MESSAGES.inputMode, mode });
    }
  });
});

describe("pageConnectionFor", () => {
  it.each([
    ["connected", "connected"],
    ["OPEN", "connected"],
    ["connecting", "connecting"],
    ["reconnecting", "connecting"],
    ["disconnected", "disconnected"],
    ["error", "disconnected"],
    ["exited", "exited"],
  ] as const)("maps %s to %s", (state, expected) => {
    expect(pageConnectionFor(state)).toBe(expected);
  });
});

describe("isDroppedPageState", () => {
  it("only treats a lost socket as worth an automatic new ticket", () => {
    expect(isDroppedPageState("disconnected")).toBe(true);
    expect(isDroppedPageState("Closed")).toBe(true);
    expect(isDroppedPageState("error")).toBe(false);
    expect(isDroppedPageState("exited")).toBe(false);
    expect(isDroppedPageState("connected")).toBe(false);
  });
});

describe("reconnectMessage", () => {
  it("matches the framed message the controller pages listen for", () => {
    expect(reconnectMessage("tkt")).toEqual({ type: "tesseract-reconnect", ticket: "tkt" });
  });
});

describe("reconnectScript", () => {
  it("calls window.tesseract.reconnect with a safely quoted ticket and ends in true", () => {
    const script = reconnectScript('ab"c</script>');
    expect(script).toContain('t.reconnect("ab\\"c</script>")');
    expect(script.endsWith("true;")).toBe(true);
  });

  it("is a no-op when the page has no bridge", () => {
    const run = new Function("window", reconnectScript("tkt"));
    expect(() => run({})).not.toThrow();
    expect(() => run({ tesseract: {} })).not.toThrow();
    const reconnect = jest.fn();
    run({ tesseract: { reconnect } });
    expect(reconnect).toHaveBeenCalledWith("tkt");
  });
});

describe("contract with the controller's /ui pages", () => {
  it("understands every state message the pages post", () => {
    for (const state of PAGE_STATES) {
      const terminal = parsePageMessage({ type: PAGE_MESSAGES.terminalState, state }, "terminal");
      const vnc = parsePageMessage(JSON.stringify({ type: PAGE_MESSAGES.vncState, state }), "vnc");
      expect(terminal?.page).toBe("terminal");
      expect(vnc?.page).toBe("vnc");
    }
  });

  it("maps page states onto app connection states", () => {
    expect(PAGE_STATES.map(pageConnectionFor)).toEqual(["connecting", "connected", "disconnected", "exited", "disconnected"]);
    expect(PAGE_STATES.filter(isDroppedPageState)).toEqual(["disconnected"]);
  });

  it("understands both ticket requests and answers with the reconnect message", () => {
    expect(parsePageMessage({ type: PAGE_MESSAGES.terminalNeedTicket, session: "trm_1" })).toEqual({ page: "terminal", kind: "need-ticket" });
    expect(parsePageMessage({ type: PAGE_MESSAGES.vncNeedTicket })).toEqual({ page: "vnc", kind: "need-ticket" });
    expect(reconnectMessage("tkt").type).toBe(PAGE_MESSAGES.reconnect);
  });
});
