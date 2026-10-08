import { ApiError } from "@tesseract/client";
import type { DisplayStatus } from "@tesseract/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RfbChannel, RfbCredentials, RfbLike, RfbOptions } from "./rfb-types";
import { VncSession, type SessionDeps } from "./session";

const ready: DisplayStatus = {
  display: ":1",
  available: true,
  width: 1600,
  height: 900,
  vnc: { available: true, port: 5901, password: "secret" },
  webPath: "/ui/vnc",
};

class FakeRfb extends EventTarget implements RfbLike {
  viewOnly = false;
  focusOnClick = true;
  clipViewport = true;
  scaleViewport = false;
  resizeSession = true;
  showDotCursor = true;
  background = "";
  qualityLevel = 6;
  compressionLevel = 2;
  credentials: RfbCredentials[] = [];
  keys: [number, boolean | undefined][] = [];
  pasted: string[] = [];
  disconnected = false;
  readonly screen: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;

  constructor(
    readonly target: HTMLElement,
    readonly channel: string | RfbChannel,
    readonly options: RfbOptions,
  ) {
    super();
    this.screen = document.createElement("div");
    this.canvas = document.createElement("canvas");
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.screen.appendChild(this.canvas);
    target.appendChild(this.screen);
  }

  serverInit(width: number, height: number, name: string) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.dispatchEvent(new CustomEvent("desktopname", { detail: { name } }));
    this.dispatchEvent(new CustomEvent("connect", { detail: {} }));
  }

  emit(type: string, detail: unknown = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  serverClose() {
    this.screen.remove();
    this.emit("disconnect", { clean: false });
  }

  disconnect() {
    this.disconnected = true;
    this.screen.remove();
  }
  sendCredentials(credentials: RfbCredentials) {
    this.credentials.push(credentials);
  }
  sendKey(keysym: number, _code: string | null, down?: boolean) {
    this.keys.push([keysym, down]);
  }
  focus() {}
  blur() {}
  clipboardPasteFrom(text: string) {
    this.pasted.push(text);
  }
}

function setup(overrides: Partial<SessionDeps> = {}) {
  const rfbs: FakeRfb[] = [];
  const timers: { callback: () => void; ms: number }[] = [];
  const opened: string[] = [];
  let ticket = 0;
  const deps: SessionDeps = {
    fetchStatus: vi.fn(async () => ready),
    createTicket: vi.fn(async () => `t${(ticket += 1)}`),
    openChannel: (value) => {
      opened.push(value);
      return `ws://sandbox/v1/display/vnc?ticket=${value}`;
    },
    createRfb: async (target, open, options) => {
      const rfb = new FakeRfb(target, open(), options);
      rfbs.push(rfb);
      return rfb;
    },
    isAuthError: (error) => error instanceof ApiError && error.status === 401,
    describeError: (error) => (error instanceof Error ? error.message : String(error)),
    now: () => 10_000,
    random: () => 1,
    setTimer: (callback, ms) => {
      timers.push({ callback, ms });
      return timers.length;
    },
    clearTimer: () => undefined,
    ...overrides,
  };
  const target = document.createElement("div");
  const session = new VncSession(deps);
  session.attach(target);
  return { session, deps, rfbs, timers, opened, target };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("VncSession", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.restoreAllMocks());

  it("connects with a fresh ticket and the GTK-equivalent RFB settings", async () => {
    const { session, rfbs, opened } = setup();
    session.start();
    expect(session.state.phase).toBe("connecting");
    await flush();
    const rfb = rfbs[0]!;
    expect(opened).toEqual(["t1"]);
    expect(rfb.options).toEqual({ wsProtocols: ["binary"], shared: true });
    expect(rfb).toMatchObject({ scaleViewport: true, clipViewport: false, resizeSession: false, showDotCursor: false, compressionLevel: 1, qualityLevel: 9 });
    rfb.serverInit(1600, 900, "Tesseract tesseract-sandbox");
    expect(session.state).toMatchObject({ phase: "connected", width: 1600, height: 900, name: "Tesseract tesseract-sandbox", attempt: 0, error: null });
  });

  it("sends the status password on credentialsrequired", async () => {
    const { session, rfbs } = setup();
    session.start();
    await flush();
    rfbs[0]!.emit("credentialsrequired", { types: ["password"] });
    expect(session.state.phase).toBe("authenticating");
    expect(rfbs[0]!.credentials).toEqual([{ password: "secret" }]);
  });

  it("fails auth without a password and on security failure", async () => {
    const empty = setup({ fetchStatus: async () => ({ ...ready, vnc: { ...ready.vnc, password: null } }) });
    empty.session.start();
    await flush();
    empty.rfbs[0]!.emit("credentialsrequired");
    expect(empty.session.state).toMatchObject({ phase: "auth_failed", error: "the server needs a VNC password" });

    const rejected = setup();
    rejected.session.start();
    await flush();
    rejected.rfbs[0]!.emit("securityfailure", { status: 1, reason: "" });
    expect(rejected.session.state).toMatchObject({ phase: "auth_failed", error: "authentication failed" });
    rejected.rfbs[0]!.serverClose();
    expect(rejected.session.state.phase).toBe("auth_failed");
    expect(rejected.timers).toHaveLength(0);
  });

  it("treats a close while authenticating as a rejected password", async () => {
    const { session, rfbs, timers } = setup();
    session.start();
    await flush();
    rfbs[0]!.emit("credentialsrequired");
    rfbs[0]!.serverClose();
    expect(session.state).toMatchObject({ phase: "auth_failed", error: null });
    expect(timers).toHaveLength(0);
  });

  it("retries with backoff after a server close and keeps the last frame", async () => {
    const { session, rfbs, timers, target } = setup();
    session.start();
    await flush();
    rfbs[0]!.serverInit(800, 600, "x");
    rfbs[0]!.serverClose();
    expect(session.state).toMatchObject({ phase: "retrying", attempt: 1, error: null, retryAt: 11_000 });
    expect(timers[0]!.ms).toBe(1000);
    expect(target.querySelector("[data-vnc-ghost] canvas")).not.toBeNull();
    timers[0]!.callback();
    await flush();
    expect(rfbs).toHaveLength(2);
    rfbs[1]!.serverInit(800, 600, "x");
    expect(target.querySelector("[data-vnc-ghost]")).toBeNull();
    expect(session.state.attempt).toBe(0);
  });

  it("reports unavailable VNC without retrying", async () => {
    const { session, timers, rfbs } = setup({ fetchStatus: async () => ({ ...ready, vnc: { ...ready.vnc, available: false } }) });
    session.start();
    await flush();
    expect(session.state.phase).toBe("unavailable");
    expect(session.state.status?.vnc.available).toBe(false);
    expect(timers).toHaveLength(0);
    expect(rfbs).toHaveLength(0);
  });

  it("fails on auth errors and retries other request errors", async () => {
    const auth = setup({ createTicket: async () => Promise.reject(new ApiError(401, "unauthorized", "Token rejected")) });
    auth.session.start();
    await flush();
    expect(auth.session.state).toMatchObject({ phase: "failed", error: "Token rejected" });

    const network = setup({ fetchStatus: async () => Promise.reject(new Error("socket hang up")) });
    network.session.start();
    await flush();
    expect(network.session.state).toMatchObject({ phase: "retrying", error: "socket hang up", attempt: 1 });
  });

  it("sends key combos as press-all then release-in-reverse, never in view-only", async () => {
    const { session, rfbs } = setup();
    session.start();
    await flush();
    rfbs[0]!.serverInit(10, 10, "");
    session.sendKeys([1, 2, 3]);
    expect(rfbs[0]!.keys).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [3, false],
      [2, false],
      [1, false],
    ]);
    session.setViewOnly(true);
    expect(rfbs[0]!.viewOnly).toBe(true);
    session.sendKeys([9]);
    session.pasteClipboard("nope");
    expect(rfbs[0]!.keys).toHaveLength(6);
    expect(rfbs[0]!.pasted).toEqual([]);
  });

  it("forwards server clipboard text and toggles scaling", async () => {
    const { session, rfbs } = setup();
    const received: string[] = [];
    session.callbacks.onClipboard = (text) => received.push(text);
    session.start();
    await flush();
    rfbs[0]!.emit("clipboard", { text: "hello" });
    expect(received).toEqual(["hello"]);
    session.setFit(false);
    expect(rfbs[0]!.scaleViewport).toBe(false);
  });

  it("stop and reconnect tear the connection down", async () => {
    const { session, rfbs } = setup();
    session.start();
    await flush();
    session.reconnect();
    expect(rfbs[0]!.disconnected).toBe(true);
    await flush();
    expect(rfbs).toHaveLength(2);
    session.stop();
    expect(rfbs[1]!.disconnected).toBe(true);
    expect(session.state).toMatchObject({ phase: "idle", error: null, attempt: 0 });
  });

  it("releases held keys when focus leaves the canvas for elsewhere in the window", async () => {
    const { session, rfbs } = setup();
    session.start();
    await flush();
    const rfb = rfbs[0]!;
    rfb.serverInit(10, 10, "");
    const writes: boolean[] = [];
    let value = rfb.viewOnly;
    Object.defineProperty(rfb, "viewOnly", {
      get: () => value,
      set: (next: boolean) => {
        writes.push(next);
        value = next;
      },
    });
    rfb.canvas.dispatchEvent(new FocusEvent("focusout", { relatedTarget: document.body }));
    expect(writes).toEqual([true, false]);
    session.setViewOnly(true);
    writes.length = 0;
    rfb.canvas.dispatchEvent(new FocusEvent("focusout", { relatedTarget: document.body }));
    expect(writes).toEqual([]);
    session.stop();
    session.setViewOnly(false);
    rfb.canvas.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null }));
    expect(writes).toEqual([]);
  });

  it("reconnects for a full frame when the canvas context is restored", async () => {
    const { session, rfbs } = setup();
    session.start();
    await flush();
    rfbs[0]!.serverInit(10, 10, "");
    rfbs[0]!.canvas.dispatchEvent(new Event("contextrestored"));
    expect(rfbs[0]!.disconnected).toBe(true);
    await flush();
    expect(rfbs).toHaveLength(2);
  });

  it("fails without a client", () => {
    const session = new VncSession(null);
    session.attach(document.createElement("div"));
    session.start();
    expect(session.state.phase).toBe("failed");
  });
});
