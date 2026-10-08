import { describe, expect, it, vi } from "vitest";
import { PAIR_LABELS } from "./labels";
import { middleSplit } from "./middle-split";
import { fill, hostPanel, sandboxPanel } from "./model";
import { qrMatrix } from "./qr";

const actions = { openPreferences: vi.fn(), startHost: vi.fn(), retryHost: vi.fn(), setPin: vi.fn() };
const pairing = { link: "tesseract://host?x", url: "http://h:7701", name: "box", pinSet: true };

describe("sandboxPanel", () => {
  it("asks to set up when unconfigured", () => {
    const panel = sandboxPanel({ kind: "unconfigured" }, actions);
    expect(panel.link).toBeNull();
    expect(panel.notices[0]).toMatchObject({ tone: "warning", message: PAIR_LABELS.unconfigured, actionLabel: PAIR_LABELS.setUp });
  });

  it("reports link errors", () => {
    const panel = sandboxPanel({ kind: "invalid", error: "no token" }, actions);
    expect(panel.notices[0]).toMatchObject({ tone: "danger", message: "Can't build a pairing link: no token" });
  });

  it("captions with the name and warns when offline", () => {
    const panel = sandboxPanel({ kind: "ready", link: "tesseract://pair", url: "https://s", name: "sb", online: false }, actions);
    expect(panel.caption).toBe("Sandbox sb · https://s");
    expect(panel.notices.map((notice) => notice.id)).toEqual(["offline"]);
    expect(sandboxPanel({ kind: "ready", link: "l", url: "https://s", online: true }, actions)).toEqual({ link: "l", caption: "https://s", notices: [] });
  });
});

describe("hostPanel", () => {
  it("orders the status notice before the pairing notice", () => {
    const panel = hostPanel({ status: "stopped", error: null, pairing: null }, actions);
    expect(panel.notices.map((notice) => notice.id)).toEqual(["stopped", "loading"]);
  });

  it("does not show loading when failed", () => {
    const panel = hostPanel({ status: "failed", error: "port busy", pairing: null }, actions);
    expect(panel.notices).toHaveLength(1);
    expect(panel.notices[0]).toMatchObject({ message: "The host shell couldn't start: port busy", actionLabel: PAIR_LABELS.retry });
  });

  it("asks for a PIN and builds the caption", () => {
    const panel = hostPanel({ status: "running", error: null, pairing: { ...pairing, pinSet: false } }, actions);
    expect(panel.link).toBe("tesseract://host?x");
    expect(panel.caption).toBe("Host box · http://h:7701");
    expect(panel.notices[0]).toMatchObject({ id: "no-pin", actionLabel: PAIR_LABELS.setPin });
    const withoutAction = hostPanel({ status: "running", error: null, pairing: { ...pairing, pinSet: false } }, { ...actions, setPin: undefined });
    expect(withoutAction.notices[0]?.actionLabel).toBeUndefined();
  });

  it("is quiet when running with a PIN and loading without a state", () => {
    expect(hostPanel({ status: "running", error: null, pairing }, actions).notices).toEqual([]);
    expect(hostPanel({ status: "external", error: null, pairing }, actions).notices.map((notice) => notice.id)).toEqual(["external"]);
    expect(hostPanel(null, actions).notices.map((notice) => notice.id)).toEqual(["loading"]);
  });
});

describe("helpers", () => {
  it("fills templates and leaves unknown keys", () => {
    expect(fill("{a}-{b}", { a: "1" })).toBe("1-{b}");
  });

  it("splits text in the middle", () => {
    expect(middleSplit("abcde")).toEqual(["abc", "de"]);
  });

  it("builds a square QR path", () => {
    const matrix = qrMatrix("tesseract://pair?url=x");
    expect(matrix.size).toBeGreaterThanOrEqual(21);
    expect(matrix.path.startsWith("M0 0h7")).toBe(true);
  });
});
