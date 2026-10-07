import type { DisplayStatus, DisplayWindow } from "@theone/protocol";
import { sampleDisplay } from "@theone/protocol/fixtures";
import { GTK_PARITY } from "../projects/parity";
import { currentScenario } from "../scenario";
import type { FixtureVncAuth } from "./vnc-server";

export const DISPLAY_SCENARIOS = {
  live: null,
  gtkParity: GTK_PARITY,
  connecting: "display-connecting",
  retrying: "display-retrying",
  authFailed: "display-auth-failed",
  vncPassword: "display-vnc-password",
  loading: "display-loading",
  error: "display-error",
  noDisplay: "display-none",
  preview: "display-preview",
  noWindows: "display-no-windows",
} as const;

export const FIXTURE_DISPLAY_ERROR = "The controller could not read the display (502).";

export const fixtureWindows: DisplayWindow[] = [
  { id: "0x1a00003", title: "about:blank - Chromium", app: "Chromium", pid: 412, active: true, minimized: false },
  { id: "0x2200004", title: "dev@sandbox: /workspace/monolith", app: "XTerm", pid: 977, active: false, minimized: false },
  { id: "0x2400002", title: "monolith (Flutter Linux)", app: "monolith", pid: 1204, active: false, minimized: true },
  { id: "0x2600007", title: "   ", app: null, pid: null, active: false, minimized: false },
];

export function scenarioDisplayStatus(scenario: string | null = currentScenario()): DisplayStatus | null {
  switch (scenario) {
    case DISPLAY_SCENARIOS.loading:
    case DISPLAY_SCENARIOS.error:
      return null;
    case DISPLAY_SCENARIOS.noDisplay:
      return { ...sampleDisplay, available: false, width: null, height: null, vnc: { ...sampleDisplay.vnc, available: false } };
    case DISPLAY_SCENARIOS.preview:
      return { ...sampleDisplay, vnc: { ...sampleDisplay.vnc, available: false } };
    default:
      return sampleDisplay;
  }
}

export function scenarioWindows(scenario: string | null = currentScenario()): DisplayWindow[] {
  return scenario === DISPLAY_SCENARIOS.noWindows ? [] : fixtureWindows;
}

export type FixtureVncBehaviour = FixtureVncAuth | "hang" | "drop";

export function scenarioVncBehaviour(scenario: string | null = currentScenario()): FixtureVncBehaviour {
  switch (scenario) {
    case DISPLAY_SCENARIOS.connecting:
      return "hang";
    case DISPLAY_SCENARIOS.retrying:
      return "drop";
    case DISPLAY_SCENARIOS.authFailed:
      return "reject";
    case DISPLAY_SCENARIOS.vncPassword:
      return "vnc";
    default:
      return "none";
  }
}
