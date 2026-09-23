import { PAGE_MESSAGES, PAGE_STATES } from "@theone/protocol";

import {
  isDroppedPageState,
  pageConnectionFor,
  parsePageMessage,
  reconnectMessage,
  reconnectScript,
} from "@/features/sandbox/utils/web-bridge";

describe("parsePageMessage", () => {
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
    expect(reconnectMessage("tkt")).toEqual({ type: "theone-reconnect", ticket: "tkt" });
  });
});

describe("reconnectScript", () => {
  it("calls window.theone.reconnect with a safely quoted ticket and ends in true", () => {
    const script = reconnectScript('ab"c</script>');
    expect(script).toContain('t.reconnect("ab\\"c</script>")');
    expect(script.endsWith("true;")).toBe(true);
  });

  it("is a no-op when the page has no bridge", () => {
    const run = new Function("window", reconnectScript("tkt"));
    expect(() => run({})).not.toThrow();
    expect(() => run({ theone: {} })).not.toThrow();
    const reconnect = jest.fn();
    run({ theone: { reconnect } });
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
