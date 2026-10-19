import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostShellState } from "../../../shared/contracts/hostShell";
import { hostFixtureState, resetHostFixtures } from "../../fixtures/host/data";
import { overrideIpcFixtures } from "../../fixtures/registry";
import { hostTerminalSessions, useHostTerminalsUi } from "../../features/shell/scope";
import type { TerminalHost } from "../../features/terminals/xterm-host";
import { renderRoutes } from "../../test/render";
import ShellPage from "./ShellPage";

function fakeHost(): TerminalHost {
  return {
    element: document.createElement("div"),
    mount: vi.fn(),
    unmount: vi.fn(),
    refit: vi.fn(),
    focus: vi.fn(),
    grid: () => ({ cols: 80, rows: 24 }),
    write: vi.fn(),
    reset: vi.fn(),
    setInputEnabled: vi.fn(),
    setScheme: vi.fn(),
    run: vi.fn(),
    hasSelection: () => false,
    mouseTracking: () => false,
    dispose: vi.fn(),
  };
}

let host: HostShellState;
const unlock = vi.fn();

function renderPage() {
  return renderRoutes([{ path: "/:pageId/*", element: <ShellPage /> }], "/shell");
}

describe("ShellPage", () => {
  let restoreFixtures: () => void;
  let restoreFactory: () => void;
  beforeEach(() => {
    host = hostFixtureState();
    restoreFixtures = overrideIpcFixtures({
      hostShell: {
        state: () => host,
        unlock: (pin) => {
          unlock(pin);
          host = hostFixtureState();
          return host;
        },
        lock: () => {
          host = { ...host, sessionExpiresAt: null };
          return host;
        },
      },
    });
    restoreFactory = hostTerminalSessions.setHostFactory(fakeHost);
  });
  afterEach(() => {
    hostTerminalSessions.reset();
    useHostTerminalsUi.getState().reset();
    restoreFactory();
    restoreFixtures();
    resetHostFixtures();
    unlock.mockReset();
  });

  it("lists the host's shells", async () => {
    renderPage();
    expect(await screen.findByText("Shell · tesseract")).toBeTruthy();
    expect(screen.getByText("No session selected")).toBeTruthy();
    expect(screen.queryByText("New Claude session")).toBeNull();
  });

  it("starts a new host shell from the placeholder", async () => {
    renderPage();
    await screen.findByText("Shell · tesseract");
    fireEvent.click(screen.getByRole("button", { name: "New shell" }));
    await waitFor(() => expect(useHostTerminalsUi.getState().selectedId).toBe("trm_host_new_1"));
  });

  it("asks for the PIN while the host shell is locked", async () => {
    host = hostFixtureState({ sessionExpiresAt: null });
    renderPage();
    expect(await screen.findByText("The host shell is locked")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    const pin = await screen.findByLabelText("PIN");
    fireEvent.change(pin, { target: { value: "123456" } });
    fireEvent.submit(pin.closest("form")!);
    await waitFor(() => expect(unlock).toHaveBeenCalledWith("123456"));
    expect(await screen.findByText("Shell · tesseract")).toBeTruthy();
  });

  it("offers to start a stopped daemon", async () => {
    host = hostFixtureState({ status: "stopped", sessionExpiresAt: null });
    renderPage();
    expect(await screen.findByText("The host shell is off")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start host shell" })).toBeTruthy();
  });

  it("explains a machine without a host", async () => {
    host = hostFixtureState({ pairing: null });
    renderPage();
    expect(await screen.findByText("No host shell for this machine")).toBeTruthy();
  });
});
