import { describe, expect, it, vi } from "vitest";
import { PAIR_SAMPLES } from "./gallery-samples";
import { PAIR_COMMANDS, PAIR_LABELS } from "./labels";
import { middleSplit } from "./middle-split";
import { fill, hostPanel, masterPanel, pairTargets, sandboxPanel, visibleTarget } from "./model";
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
    expect(sandboxPanel({ kind: "ready", link: "l", url: "https://s", online: true }, actions)).toEqual({
      link: "l",
      caption: "https://s",
      notices: [],
      steps: [],
      linkInput: null,
    });
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

describe("host setup steps", () => {
  it("points at Start and the autostart setting when the host shell is down", () => {
    for (const status of ["stopped", "failed"] as const) {
      const panel = hostPanel({ status, error: "x", pairing: null }, actions);
      expect(panel.steps.map((step) => step.id)).toEqual(["start", "autostart"]);
      expect(panel.steps.every((step) => step.command === undefined)).toBe(true);
      expect(panel.steps[0]?.text).toBe("Start it now with Start above.");
    }
  });

  it("hides the steps while running or starting", () => {
    expect(hostPanel({ status: "running", error: null, pairing }, actions).steps).toEqual([]);
    expect(hostPanel({ status: "starting", error: null, pairing: null }, actions).steps).toEqual([]);
  });
});

describe("masterPanel", () => {
  const masterActions = { openPreferences: vi.fn(), unlinkMaster: vi.fn() };

  it("shows a loading notice before the state arrives", () => {
    expect(masterPanel(null, masterActions).notices.map((notice) => notice.id)).toEqual(["loading"]);
  });

  it("asks to set up without a sandbox", () => {
    const panel = masterPanel({ kind: "none" }, masterActions);
    expect(panel.link).toBeNull();
    expect(panel.notices[0]).toMatchObject({ message: PAIR_LABELS.unconfigured, actionLabel: PAIR_LABELS.setUp, onAction: masterActions.openPreferences });
  });

  it("explains a local sandbox", () => {
    expect(masterPanel({ kind: "local" }, masterActions).notices[0]?.message).toBe(PAIR_LABELS.masterLocal);
  });

  it("lists the link steps and a paste field when unlinked", () => {
    const panel = masterPanel(PAIR_SAMPLES.masterUnlinked, masterActions);
    expect(panel.link).toBeNull();
    expect(panel.steps.map((step) => [step.text, step.command ?? null, step.input ?? false])).toEqual([
      ["On the machine that runs the sandbox, install the host shell:", "tesseract server install", false],
      ["Print its pairing links:", "tesseract server pair", false],
      ["Copy the tesseract://host?… link and paste it here.", null, true],
    ]);
    expect(panel.linkInput).toMatchObject({ submitLabel: "Link", placeholder: "tesseract://host?…" });
    expect(panel.notices[0]?.message).toContain("https://tesseract-sandbox.tail511d9d.ts.net");
  });

  it("shows the QR when linked and online", () => {
    const panel = masterPanel(PAIR_SAMPLES.masterLinked, masterActions);
    expect(panel.link).toBe(PAIR_SAMPLES.masterLinked.host.link);
    expect(panel.caption).toBe("Master host studio-mac · http://100.88.12.9:7701");
    expect(panel.notices).toEqual([]);
    expect(panel.steps).toEqual([]);
    expect(panel.linkInput).toBeNull();
  });

  it("keeps the QR when offline, warns, offers Unlink and the start steps", () => {
    const panel = masterPanel(PAIR_SAMPLES.masterOffline, masterActions);
    expect(panel.link).toBe(PAIR_SAMPLES.masterOffline.host.link);
    expect(panel.notices[0]).toMatchObject({ id: "offline", tone: "warning", actionLabel: "Unlink", onAction: masterActions.unlinkMaster });
    expect(panel.steps.map((step) => step.command)).toEqual([PAIR_COMMANDS.install, PAIR_COMMANDS.status]);
  });

  it("captions with the URL alone when the host has no name", () => {
    const state = { ...PAIR_SAMPLES.masterLinked, host: { ...PAIR_SAMPLES.masterLinked.host, name: null } };
    expect(masterPanel(state, masterActions).caption).toBe("http://100.88.12.9:7701");
  });
});

describe("pairTargets", () => {
  it("hides the master tab for local sandboxes and when not provided", () => {
    expect(pairTargets(undefined)).toEqual(["sandbox", "host"]);
    expect(pairTargets({ kind: "local" })).toEqual(["sandbox", "host"]);
    expect(pairTargets(null)).toEqual(["sandbox", "host", "master"]);
    expect(pairTargets({ kind: "none" })).toEqual(["sandbox", "host", "master"]);
  });

  it("falls back to This computer when the master tab is hidden", () => {
    expect(visibleTarget("master", ["sandbox", "host"])).toBe("host");
    expect(visibleTarget("master", ["sandbox", "host", "master"])).toBe("master");
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
