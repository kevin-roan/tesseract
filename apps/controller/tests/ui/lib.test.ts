import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { KeyBar, Overlay, StatusBadge } from "../../src/ui/lib/components";
import { API_PATHS, APPLICATION_CURSOR_SEQUENCES, HARDWARE_KEYS, HOST_MESSAGES, KEY_BAR, KEYSYMS, TERMINAL_SEQUENCES, VNC_KEYS } from "../../src/ui/lib/config";
import { keepFocus, requireElement } from "../../src/ui/lib/dom";
import { takeFragment } from "../../src/ui/lib/fragment";
import { exposeHostApi, hasHost, postToHost } from "../../src/ui/lib/host";
import { keysymForChar, withCtrl } from "../../src/ui/lib/keys";
import { webSocketUrl } from "../../src/ui/lib/socket";

const GLOBALS = ["window", "document", "history"] as const;
type Globals = Record<(typeof GLOBALS)[number], unknown>;

let dom: Window;
let saved: Globals;

function useDom(url: string): void {
  dom?.happyDOM.abort();
  dom = new Window({ url });
  const target = globalThis as unknown as Globals;
  target.window = dom;
  target.document = dom.document;
  target.history = dom.history;
}

beforeEach(() => {
  const source = globalThis as unknown as Globals;
  saved = { window: source.window, document: source.document, history: source.history };
  useDom("https://box.example.ts.net/ui/terminal");
});

afterEach(async () => {
  await dom.happyDOM.close();
  const target = globalThis as unknown as Globals;
  for (const key of GLOBALS) {
    if (saved[key] === undefined) delete target[key];
    else target[key] = saved[key];
  }
});

describe("keys", () => {
  test("withCtrl maps letters and the usual punctuation to control codes", () => {
    expect(withCtrl("c")).toBe("\x03");
    expect(withCtrl("C")).toBe("\x03");
    expect(withCtrl("a")).toBe("\x01");
    expect(withCtrl("[")).toBe("\x1b");
    expect(withCtrl("@")).toBe("\x00");
    expect(withCtrl("_")).toBe("\x1f");
    expect(withCtrl(" ")).toBe("\x00");
    expect(withCtrl("?")).toBe("\x7f");
    expect(withCtrl("1")).toBe("1");
    expect(withCtrl("ab")).toBe("ab");
    expect(withCtrl("")).toBe("");
  });

  test("withCtrl leaves non-ASCII letters alone even when their uppercase is ASCII", () => {
    expect(withCtrl("ß")).toBe("ß");
    expect(withCtrl("ı")).toBe("ı");
    expect(withCtrl("ſ")).toBe("ſ");
    expect(withCtrl("é")).toBe("é");
  });

  test("keysymForChar", () => {
    expect(keysymForChar("\n")).toBe(KEYSYMS.enter);
    expect(keysymForChar("\r")).toBe(KEYSYMS.enter);
    expect(keysymForChar("\t")).toBe(KEYSYMS.tab);
    expect(keysymForChar("\b")).toBe(KEYSYMS.backspace);
    expect(keysymForChar("a")).toBe(0x61);
    expect(keysymForChar("~")).toBe(0x7e);
    expect(keysymForChar("é")).toBe(0xe9);
    expect(keysymForChar("€")).toBe(0x010020ac);
    expect(keysymForChar("😀")).toBe(0x0101f600);
    expect(keysymForChar("\x01")).toBe(0x01000001);
  });

  test("key tables cover every on-screen key", () => {
    for (const key of KEY_BAR) {
      if (key.id === "ctrl") continue;
      expect(TERMINAL_SEQUENCES[key.id]).toBeDefined();
      if (key.id !== "ctrl-c") expect(VNC_KEYS[key.id]).toBeDefined();
    }
    expect(Object.keys(APPLICATION_CURSOR_SEQUENCES).sort()).toEqual(["down", "left", "right", "up"]);
    expect(HARDWARE_KEYS.Escape).toBe(KEYSYMS.escape);
    expect(API_PATHS.terminalStream("term a/b")).toBe("/v1/terminals/term%20a%2Fb/stream");
  });
});

describe("socket and fragment", () => {
  test("webSocketUrl follows the page scheme and encodes the ticket", () => {
    expect(webSocketUrl("/v1/display/vnc", "a+b/c")).toBe("wss://box.example.ts.net/v1/display/vnc?ticket=a%2Bb%2Fc");
    useDom("http://127.0.0.1:8787/ui/vnc");
    expect(webSocketUrl("/v1/events", "t")).toBe("ws://127.0.0.1:8787/v1/events?ticket=t");
  });

  test("takeFragment reads secrets and strips them from the address bar", () => {
    useDom("https://box.example.ts.net/ui/terminal?keep=1#ticket=abc&session=term_1&password=p%20w");
    const params = takeFragment();
    expect(params.get("ticket")).toBe("abc");
    expect(params.get("session")).toBe("term_1");
    expect(params.get("password")).toBe("p w");
    expect(dom.location.href).toBe("https://box.example.ts.net/ui/terminal?keep=1");
  });

  test("takeFragment without a fragment leaves history alone", () => {
    const replace = mock(() => {});
    dom.history.replaceState = replace;
    expect([...takeFragment().keys()]).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("host bridge", () => {
  test("posts to react-native-webview and to a framing parent", () => {
    expect(hasHost()).toBe(false);
    const native = mock((_message: string) => {});
    (dom as unknown as globalThis.Window).ReactNativeWebView = { postMessage: native };
    expect(hasHost()).toBe(true);
    postToHost({ type: "state", state: "connected" });
    expect(native).toHaveBeenCalledWith(JSON.stringify({ type: "state", state: "connected" }));

    const parentPost = mock(() => {});
    Object.defineProperty(dom, "parent", { value: { postMessage: parentPost }, configurable: true });
    delete (dom as { ReactNativeWebView?: unknown }).ReactNativeWebView;
    expect(hasHost()).toBe(true);
    postToHost({ type: "exit" });
    expect(parentPost).toHaveBeenCalledWith({ type: "exit" }, "*");
  });

  test("exposeHostApi accepts only well-formed reconnect messages", () => {
    const reconnect = mock((_ticket: string) => {});
    exposeHostApi({ reconnect });
    expect((dom as unknown as { theone: unknown }).theone).toEqual({ reconnect });
    const send = (data: unknown) => dom.dispatchEvent(new dom.MessageEvent("message", { data }));
    send(HOST_MESSAGES.reconnect);
    send(null);
    send({ type: "other", ticket: "t" });
    send({ type: HOST_MESSAGES.reconnect, ticket: "" });
    send({ type: HOST_MESSAGES.reconnect, ticket: 5 });
    expect(reconnect).not.toHaveBeenCalled();
    send({ type: HOST_MESSAGES.reconnect, ticket: "t1" });
    expect(reconnect).toHaveBeenCalledWith("t1");
  });
});

describe("dom helpers and components", () => {
  test("requireElement and keepFocus", () => {
    dom.document.body.innerHTML = '<div id="a"><button class="b"></button></div>';
    const root = requireElement("#a");
    expect(requireElement("button.b", root).tagName).toBe("BUTTON");
    expect(() => requireElement("#missing")).toThrow("Missing element #missing");
    keepFocus(root);
    for (const type of ["pointerdown", "mousedown"]) {
      const event = new dom.Event(type, { cancelable: true });
      root.dispatchEvent(event as unknown as Event);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  test("StatusBadge sets state and text", () => {
    const element = dom.document.createElement("span");
    new StatusBadge(element as never).set("connected", "Connected");
    expect(element.dataset.state).toBe("connected");
    expect(element.textContent).toBe("Connected");
  });

  test("Overlay shows messages with an optional action", () => {
    dom.document.body.innerHTML = '<div id="o" hidden><p data-overlay-text></p><button data-overlay-action></button></div>';
    const element = requireElement("#o");
    const overlay = new Overlay(element);
    const run = mock(() => {});
    overlay.show("Disconnected", { label: "Reconnect", run });
    const button = requireElement<HTMLButtonElement>("[data-overlay-action]");
    expect(element.hidden).toBe(false);
    expect(requireElement("[data-overlay-text]").textContent).toBe("Disconnected");
    expect(button.hidden).toBe(false);
    expect(button.textContent).toBe("Reconnect");
    button.click();
    expect(run).toHaveBeenCalledTimes(1);
    overlay.show("Session ended");
    expect(button.hidden).toBe(true);
    button.click();
    expect(run).toHaveBeenCalledTimes(1);
    overlay.hide();
    expect(element.hidden).toBe(true);

    dom.document.body.innerHTML = '<div id="bare"><button data-overlay-action></button></div>';
    const bare = requireElement("#bare");
    new Overlay(bare).show("text on the container");
    expect(bare.textContent).toBe("text on the container");
    dom.document.body.innerHTML = '<div id="broken"></div>';
    expect(() => new Overlay(requireElement("#broken"))).toThrow("data-overlay-action");
  });

  test("KeyBar renders accessible buttons; sticky keys toggle and are consumed once", () => {
    const container = dom.document.createElement("div");
    const pressed: string[] = [];
    const bar = new KeyBar(container as never, KEY_BAR, (key) => pressed.push(key));
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(KEY_BAR.length);
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Escape");
    expect(buttons[0]?.getAttribute("type")).toBe("button");
    const ctrl = buttons.find((button) => button.textContent === "Ctrl");
    expect(ctrl?.getAttribute("aria-pressed")).toBe("false");
    expect(buttons[0]?.hasAttribute("aria-pressed")).toBe(false);

    buttons[0]?.click();
    expect(pressed).toEqual(["esc"]);
    ctrl?.click();
    expect(pressed).toEqual(["esc"]);
    expect(bar.isActive("ctrl")).toBe(true);
    expect(ctrl?.getAttribute("aria-pressed")).toBe("true");
    expect(bar.consume("ctrl")).toBe(true);
    expect(bar.consume("ctrl")).toBe(false);
    expect(ctrl?.getAttribute("aria-pressed")).toBe("false");
    ctrl?.click();
    ctrl?.click();
    expect(bar.isActive("ctrl")).toBe(false);

    const down = new dom.Event("pointerdown", { cancelable: true });
    buttons[1]?.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });
});
