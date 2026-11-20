import { describe, expect, it } from "vitest";
import type { HostShellState } from "../../../../shared/contracts/hostShell";
import { LOG_TAIL_LINES } from "./constants";
import { HOST_SHELL_LABELS } from "./labels";
import { TAILNET_RUNNING, TAILNET_SIGNED_OUT } from "../../../fixtures/account/data";
import { logText, pinButtonLabel, pinSubtitle, serveChecked, serveLocked, serveSubtitle, tailnetStatusText } from "./model";

const pairing = { link: "tesseract://host?x", url: "https://host.ts.net:8443", name: "host", pinSet: true };

function state(patch: Partial<HostShellState>): HostShellState {
  return { status: "stopped", pairing, error: null, log: [], autostart: false, sessionExpiresAt: null, ...patch };
}

describe("host shell model", () => {
  it("describes every status like the GTK app", () => {
    expect(serveSubtitle(state({ status: "stopped" }))).toBe("Stopped");
    expect(serveSubtitle(state({ status: "starting" }))).toBe("Starting…");
    expect(serveSubtitle(state({ status: "running" }))).toBe("Running · https://host.ts.net:8443");
    expect(serveSubtitle(state({ status: "running", pairing: null }))).toBe("Running");
    expect(serveSubtitle(state({ status: "stopping" }))).toBe("Stopping…");
    expect(serveSubtitle(state({ status: "external" }))).toBe("Running outside Tesseract · https://host.ts.net:8443");
    expect(serveSubtitle(state({ status: "failed", error: "boom" }))).toBe("Failed: boom");
  });

  it("turns the switch on for running, external and starting and locks it while stopping or external", () => {
    expect(["running", "external", "starting"].every((status) => serveChecked(status as HostShellState["status"]))).toBe(true);
    expect(serveChecked("stopped")).toBe(false);
    expect(serveLocked("external")).toBe(true);
    expect(serveLocked("stopping")).toBe(true);
    expect(serveLocked("running")).toBe(false);
  });

  it("labels the PIN row by whether a PIN is set", () => {
    expect(pinSubtitle(pairing)).toBe(HOST_SHELL_LABELS.pin.set);
    expect(pinButtonLabel(pairing)).toBe("Change…");
    expect(pinSubtitle(null)).toBe(HOST_SHELL_LABELS.pin.unset);
    expect(pinButtonLabel({ ...pairing, pinSet: false })).toBe("Set PIN…");
  });

  it("shows the last 40 log lines or a placeholder", () => {
    expect(logText([])).toBe("No output yet");
    const lines = Array.from({ length: 50 }, (_, index) => `line ${index}`);
    const text = logText(lines).split("\n");
    expect(text).toHaveLength(LOG_TAIL_LINES);
    expect(text[0]).toBe("line 10");
    expect(text.at(-1)).toBe("line 49");
  });
});

describe("host tailnet status", () => {
  it("describes the node", () => {
    expect(tailnetStatusText(TAILNET_RUNNING)).toBe("Connected · http://devbox-host.tesseract.internal:7701");
    expect(tailnetStatusText(TAILNET_SIGNED_OUT)).toBe("Sign in under Settings › Account to use it");
    expect(tailnetStatusText({ ...TAILNET_RUNNING, status: "missing", error: "no binary" })).toBe("Not bundled with this build · no binary");
    expect(tailnetStatusText({ ...TAILNET_RUNNING, status: "off", enabled: false, tailscaleDetected: true })).toBe("Off · Tailscale is running on this computer");
  });

  it("shows the Tesseract Network URL as the serve address", () => {
    const pairing = { link: "l", url: "http://127.0.0.1:7701", publicUrl: "http://pc-host.tesseract.internal:7701", name: "pc", pinSet: true };
    expect(serveSubtitle({ status: "running", pairing, error: null })).toBe("Running · http://pc-host.tesseract.internal:7701");
  });
});
