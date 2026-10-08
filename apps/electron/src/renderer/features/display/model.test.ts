import type { DisplayStatus } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import {
  backoffDelay,
  badge,
  emptyModel,
  enabledActions,
  errorPrefix,
  fitGeometry,
  imageMimeType,
  INITIAL_SESSION,
  mapPointer,
  metaText,
  modeFor,
  normalizeClipboard,
  overlayModel,
  screenshotFileName,
  shouldPushClipboard,
  shouldReceiveClipboard,
  windowState,
  windowTitle,
  windowsInOrder,
} from "./model";
import type { SessionState } from "./types";

const ready: DisplayStatus = {
  display: ":1",
  available: true,
  width: 1600,
  height: 900,
  vnc: { available: true, port: 5901, password: "pw" },
  webPath: "/ui/vnc",
};

const session = (patch: Partial<SessionState> = {}): SessionState => ({ ...INITIAL_SESSION, ...patch });

describe("modeFor", () => {
  it("follows the page state machine", () => {
    expect(modeFor(false, ready, null)).toBe("offline");
    expect(modeFor(true, null, null)).toBe("loading");
    expect(modeFor(true, null, "boom")).toBe("error");
    expect(modeFor(true, ready, null)).toBe("viewer");
    expect(modeFor(true, { ...ready, vnc: { ...ready.vnc, available: false } }, null)).toBe("preview");
    expect(modeFor(true, { ...ready, available: false }, null)).toBe("no_display");
  });
});

describe("badge", () => {
  it("uses the phase in viewer mode and the mode otherwise", () => {
    expect(badge("viewer", "connected")).toEqual({ label: "Live", tone: "success" });
    expect(badge("viewer", "retrying")).toEqual({ label: "Reconnecting", tone: "warning" });
    expect(badge("viewer", "auth_failed")).toEqual({ label: "Password rejected", tone: "danger" });
    expect(badge("preview", "connected")).toEqual({ label: "Screenshots only", tone: "warning" });
    expect(badge("no_display", "idle")).toEqual({ label: "No display", tone: "neutral" });
    expect(badge("loading", "idle")).toEqual({ label: "Checking", tone: "info" });
  });
});

describe("fitGeometry", () => {
  it("fits and centers like the GTK viewer", () => {
    const geometry = fitGeometry(1600, 900, 710, 663, true);
    expect(geometry.scale).toBeCloseTo(0.44375);
    expect(geometry.offsetX).toBe(0);
    expect(geometry.offsetY).toBe(132);
  });

  it("upscales small framebuffers in fit mode and keeps 1:1 centered", () => {
    expect(fitGeometry(320, 200, 640, 400, true).scale).toBe(2);
    expect(fitGeometry(320, 200, 640, 400, false)).toEqual({ scale: 1, offsetX: 160, offsetY: 100 });
    expect(fitGeometry(3200, 2000, 640, 400, false)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it("falls back to unit scale for empty sizes", () => {
    expect(fitGeometry(0, 900, 100, 100, true)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it("clamps letterbox clicks to the nearest edge pixel", () => {
    const geometry = fitGeometry(100, 50, 200, 200, true);
    expect(mapPointer(0, 0, geometry, 100, 50)).toEqual([0, 0]);
    expect(mapPointer(199, 199, geometry, 100, 50)).toEqual([99, 49]);
  });
});

describe("metaText", () => {
  it("joins resolution, scale and desktop name", () => {
    const state = session({ phase: "connected", width: 1600, height: 900, name: "Tesseract tesseract-sandbox" });
    expect(metaText("viewer", state, ready, 710 / 1600)).toBe("1600×900 · 44% · Tesseract tesseract-sandbox");
  });

  it("skips the scale while not connected and uses the status size before ServerInit", () => {
    expect(metaText("viewer", session({ phase: "connecting" }), ready, 0.5)).toBe("1600×900");
  });

  it("shows only the resolution in preview and nothing elsewhere", () => {
    expect(metaText("preview", session({ name: "x" }), ready, 0.5)).toBe("1600×900");
    expect(metaText("no_display", session(), ready, 1)).toBe("");
    expect(metaText("preview", session(), { ...ready, width: null }, null)).toBe("");
  });
});

describe("enabledActions", () => {
  it("matches the spec table", () => {
    expect([...enabledActions("offline", "idle")]).toEqual([]);
    expect([...enabledActions("error", "idle")]).toEqual(["reconnect"]);
    expect([...enabledActions("preview", "idle")].sort()).toEqual(["browser", "reconnect", "screenshot", "windows"]);
    expect(enabledActions("viewer", "connecting").has("keys")).toBe(false);
    expect(enabledActions("viewer", "connected").has("keys")).toBe(true);
    expect(enabledActions("viewer", "connecting").has("fullscreen")).toBe(true);
  });
});

describe("emptyModel", () => {
  it("describes each empty mode", () => {
    expect(emptyModel("offline", "Controller is down", null, null)).toMatchObject({ icon: "offline", title: "Sandbox unreachable", message: "Controller is down", action: "Retry" });
    expect(emptyModel("loading", null, null, null)).toMatchObject({ loading: true, title: "Checking the display…", action: null });
    expect(emptyModel("error", null, "502", null)).toMatchObject({ icon: "warning", message: "502", action: "Try again" });
    expect(emptyModel("no_display", null, null, { ...ready, display: ":2" }).message).toContain("Xvnc on :2 is down");
    expect(emptyModel("no_display", null, null, null).message).toContain("Xvnc on :1 is down");
  });
});

describe("overlayModel", () => {
  it("hides when connected and spins while connecting", () => {
    expect(overlayModel(session({ phase: "connected" }), 0)).toBeNull();
    expect(overlayModel(session({ phase: "connecting" }), 0)).toMatchObject({ spinner: true, title: "Connecting to the display…" });
    expect(overlayModel(session({ phase: "idle" }), 0)).toMatchObject({ spinner: true, message: "" });
  });

  it("formats the retry countdown with the error prefix", () => {
    const model = overlayModel(session({ phase: "retrying", error: "socket closed...", attempt: 2, retryAt: 4_400 }), 1_000);
    expect(model).toMatchObject({ message: "socket closed. Reconnecting in 3s (attempt 2).", actionLabel: "Reconnect now", action: "reconnect" });
  });

  it("covers auth failures, stops and unavailable VNC", () => {
    expect(overlayModel(session({ phase: "auth_failed", error: null }), 0)?.message).toBe("The sandbox may have been restarted with a new password.");
    expect(overlayModel(session({ phase: "failed", error: null }), 0)).toMatchObject({ message: "", actionLabel: "Reconnect" });
    expect(overlayModel(session({ phase: "failed", error: "Token rejected." }), 0)?.message).toBe("Token rejected.");
    expect(overlayModel(session({ phase: "unavailable" }), 0)).toMatchObject({ action: "check", actionLabel: "Check again" });
  });

  it("strips trailing dots from errors", () => {
    expect(errorPrefix("a..")).toBe("a. ");
    expect(errorPrefix("...")).toBe("");
    expect(errorPrefix(null)).toBe("");
  });
});

describe("windows", () => {
  it("titles, states and orders windows", () => {
    expect(windowTitle({ title: "  ", app: "Chromium" })).toBe("Chromium");
    expect(windowTitle({ title: "", app: null })).toBe("Untitled window");
    expect(windowTitle({ title: " Docs ", app: "x" })).toBe("Docs");
    expect(windowState({ active: true, minimized: true })).toBe("Active");
    expect(windowState({ active: false, minimized: true })).toBe("Minimized");
    expect(windowState({ active: false, minimized: false })).toBeNull();
    expect(windowsInOrder([1, 2, 3])).toEqual([3, 2, 1]);
  });
});

describe("backoffDelay", () => {
  it("stays within [base/2, base] clamped to [1, 30]", () => {
    expect(backoffDelay(0, () => 0)).toBe(1);
    expect(backoffDelay(3, () => 0)).toBe(4);
    expect(backoffDelay(3, () => 1)).toBe(8);
    expect(backoffDelay(10, () => 1)).toBe(30);
    expect(backoffDelay(10, () => 0)).toBe(15);
  });
});

describe("helpers", () => {
  it("names screenshots with the local timestamp", () => {
    expect(screenshotFileName(new Date(2026, 9, 7, 9, 5, 3))).toBe("tesseract-display-20261007-090503.png");
  });

  it("sniffs png and svg bytes", () => {
    expect(imageMimeType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("image/png");
    expect(imageMimeType(new TextEncoder().encode("<svg xmlns='x'/>"))).toBe("image/svg+xml");
  });

  it("decides when clipboard text crosses", () => {
    expect(normalizeClipboard("a\r\nb")).toBe("a\nb");
    const base = { sync: true, connected: true, viewOnly: false, text: "hi", last: null };
    expect(shouldPushClipboard(base)).toBe(true);
    expect(shouldPushClipboard({ ...base, last: "hi" })).toBe(false);
    expect(shouldPushClipboard({ ...base, viewOnly: true })).toBe(false);
    expect(shouldPushClipboard({ ...base, connected: false })).toBe(false);
    expect(shouldReceiveClipboard({ sync: true, text: "", last: null })).toBe(false);
    expect(shouldReceiveClipboard({ sync: false, text: "x", last: null })).toBe(false);
    expect(shouldReceiveClipboard({ sync: true, text: "x", last: null })).toBe(true);
  });
});
