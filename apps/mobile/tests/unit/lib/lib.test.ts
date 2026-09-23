import { Alert, AppState, Platform } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";

import { confirm } from "@/lib/confirm";
import { confirm as confirmWeb } from "@/lib/confirm.web";
import { bindQueryManagers, createQueryClient } from "@/lib/query-client";
import { ToneColors } from "@/lib/tone";
import { isAllowedUrl, originOf } from "@/lib/url";

type AlertButton = { text: string; style: string; onPress: () => void };
type AlertOptions = { cancelable: boolean; onDismiss: () => void };

const globals = globalThis as unknown as { window?: { confirm?: unknown } };

describe("confirm (native)", () => {
  let alert: jest.SpyInstance;
  const lastCall = () => alert.mock.calls.at(-1) as [string, string, AlertButton[], AlertOptions];

  beforeEach(() => {
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });
  afterEach(() => alert.mockRestore());

  it("resolves true when the confirm button is pressed and styles it", async () => {
    const answer = confirm({ title: "Stop?", message: "Really", confirmLabel: "Stop", destructive: true });
    const [title, message, buttons, options] = lastCall();

    expect(title).toBe("Stop?");
    expect(message).toBe("Really");
    expect(buttons.map(({ text, style }) => [text, style])).toEqual([
      ["Cancel", "cancel"],
      ["Stop", "destructive"],
    ]);
    expect(options.cancelable).toBe(true);
    buttons[1].onPress();
    await expect(answer).resolves.toBe(true);
  });

  it("resolves false on cancel or dismissal", async () => {
    const cancelled = confirm({ title: "A", message: "B", confirmLabel: "Go", cancelLabel: "Keep" });
    const [, , buttons] = lastCall();
    expect(buttons[0].text).toBe("Keep");
    expect(buttons[1].style).toBe("default");
    buttons[0].onPress();
    await expect(cancelled).resolves.toBe(false);

    const dismissed = confirm({ title: "A", message: "B", confirmLabel: "Go" });
    lastCall()[3].onDismiss();
    await expect(dismissed).resolves.toBe(false);
  });
});

describe("confirm (web)", () => {
  const original = globals.window;
  afterEach(() => {
    globals.window = original;
  });

  it("asks the browser with the title and message", async () => {
    const ask = jest.fn(() => true);
    globals.window = { ...(original ?? {}), confirm: ask };
    await expect(confirmWeb({ title: "Remove?", message: "Gone", confirmLabel: "Remove" })).resolves.toBe(true);
    expect(ask).toHaveBeenCalledWith("Remove?\n\nGone");

    ask.mockReturnValue(false);
    await expect(confirmWeb({ title: "Remove?", message: "Gone", confirmLabel: "Remove" })).resolves.toBe(false);
  });

  it("declines when no browser dialog exists", async () => {
    globals.window = { ...(original ?? {}), confirm: undefined };
    await expect(confirmWeb({ title: "t", message: "m", confirmLabel: "ok" })).resolves.toBe(false);
    globals.window = undefined;
    await expect(confirmWeb({ title: "t", message: "m", confirmLabel: "ok" })).resolves.toBe(false);
  });
});

describe("createQueryClient", () => {
  it("retries queries twice when the predicate allows it, never mutations", () => {
    const shouldRetry = jest.fn((error: unknown) => error !== "fatal");
    const defaults = createQueryClient(shouldRetry).getDefaultOptions();
    const retry = defaults.queries?.retry as (count: number, error: unknown) => boolean;
    const delay = defaults.queries?.retryDelay as (attempt: number) => number;

    expect(retry(0, "flaky")).toBe(true);
    expect(retry(1, "flaky")).toBe(true);
    expect(retry(2, "flaky")).toBe(false);
    expect(retry(0, "fatal")).toBe(false);
    expect([0, 1, 2, 3, 4, 10].map(delay)).toEqual([1_000, 2_000, 4_000, 8_000, 8_000, 8_000]);
    expect(defaults.queries?.staleTime).toBeGreaterThan(0);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it("retries every error by default", () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (count: number, error: unknown) => boolean;
    expect(retry(0, new Error("x"))).toBe(true);
  });
});

describe("bindQueryManagers", () => {
  const originalOS = Platform.OS;
  let focusListener: jest.SpyInstance;
  let onlineListener: jest.SpyInstance;

  beforeEach(() => {
    focusListener = jest.spyOn(focusManager, "setEventListener").mockImplementation(() => undefined);
    onlineListener = jest.spyOn(onlineManager, "setEventListener").mockImplementation(() => undefined);
    (Network.addNetworkStateListener as jest.Mock).mockClear();
    (Network.getNetworkStateAsync as jest.Mock).mockClear();
  });
  afterEach(() => {
    focusListener.mockRestore();
    onlineListener.mockRestore();
    Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
  });

  it("leaves the browser defaults alone on web", () => {
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    bindQueryManagers();
    expect(focusListener).not.toHaveBeenCalled();
    expect(onlineListener).not.toHaveBeenCalled();
  });

  it("maps app state to focus", () => {
    const remove = jest.fn();
    let onChange: (state: string) => void = () => undefined;
    const addListener = jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      onChange = handler as (state: string) => void;
      return { remove } as never;
    });

    bindQueryManagers();
    const setup = focusListener.mock.calls[0][0] as (setFocused: (focused: boolean) => void) => () => void;
    const setFocused = jest.fn();
    const cleanup = setup(setFocused);

    onChange("active");
    onChange("background");
    expect(setFocused.mock.calls).toEqual([[true], [false]]);
    cleanup();
    expect(remove).toHaveBeenCalled();
    addListener.mockRestore();
  });

  it("maps network state to online, preferring live events over the initial read", async () => {
    const remove = jest.fn();
    let onNetwork: (state: { isConnected: boolean | null }) => void = () => undefined;
    (Network.addNetworkStateListener as jest.Mock).mockImplementation((handler) => {
      onNetwork = handler;
      return { remove };
    });
    let resolveInitial: (state: { isConnected: boolean }) => void = () => undefined;
    (Network.getNetworkStateAsync as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (resolveInitial = resolve)),
    );

    bindQueryManagers();
    const setup = onlineListener.mock.calls[0][0] as (setOnline: (online: boolean) => void) => () => void;
    const setOnline = jest.fn();
    const cleanup = setup(setOnline);

    onNetwork({ isConnected: false });
    onNetwork({ isConnected: null });
    resolveInitial({ isConnected: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(setOnline.mock.calls).toEqual([[false], [true]]);
    cleanup();
    expect(remove).toHaveBeenCalled();
  });

  it("uses the initial read until an event arrives and survives a failed read", async () => {
    (Network.addNetworkStateListener as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({ isConnected: false });

    bindQueryManagers();
    const setup = onlineListener.mock.calls[0][0] as (setOnline: (online: boolean) => void) => () => void;
    const setOnline = jest.fn();
    setup(setOnline);
    await new Promise((resolve) => setImmediate(resolve));
    expect(setOnline).toHaveBeenCalledWith(false);

    (Network.getNetworkStateAsync as jest.Mock).mockRejectedValueOnce(new Error("no permission"));
    const second = jest.fn();
    setup(second);
    await new Promise((resolve) => setImmediate(resolve));
    expect(second).not.toHaveBeenCalled();
  });
});

describe("url", () => {
  it("extracts a lower-cased http(s) origin", () => {
    expect(originOf("  HTTPS://Box.Tail.ts.net:7700/ui/vnc?x#y ")).toBe("https://box.tail.ts.net:7700");
    expect(originOf("http://127.0.0.1:7700")).toBe("http://127.0.0.1:7700");
    expect(originOf("javascript:alert(1)")).toBeNull();
    expect(originOf("file:///etc/passwd")).toBeNull();
    expect(originOf("")).toBeNull();
  });

  it("only allows the sandbox origin and about:blank", () => {
    const origin = "http://127.0.0.1:7700";
    expect(isAllowedUrl("http://127.0.0.1:7700/ui/terminal", origin)).toBe(true);
    expect(isAllowedUrl("HTTP://127.0.0.1:7700/x", "HTTP://127.0.0.1:7700")).toBe(true);
    expect(isAllowedUrl("about:blank", origin)).toBe(true);
    expect(isAllowedUrl("http://127.0.0.1:7701/", origin)).toBe(false);
    expect(isAllowedUrl("http://127.0.0.1:7700.evil.com/", origin)).toBe(false);
    expect(isAllowedUrl("http://evil.com/?http://127.0.0.1:7700", origin)).toBe(false);
    expect(isAllowedUrl("http://127.0.0.1:7700@evil.com/", origin)).toBe(false);
    expect(isAllowedUrl("data:text/html,hi", origin)).toBe(false);
  });
});

describe("ToneColors", () => {
  it("defines a foreground and background for every tone", () => {
    for (const tone of ["neutral", "info", "success", "warning", "danger"] as const) {
      expect(ToneColors[tone]).toEqual({ foreground: expect.any(String), background: expect.any(String) });
    }
  });
});
