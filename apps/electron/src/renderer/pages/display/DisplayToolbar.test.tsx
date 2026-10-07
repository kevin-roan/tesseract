import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DisplayPageModel } from "../../features/display/hooks/use-display-page";
import { badge, emptyModel, enabledActions, INITIAL_SESSION } from "../../features/display/model";
import type { DisplayMode, SessionPhase } from "../../features/display/types";
import { VncSession } from "../../features/display/vnc/session";
import { renderWithProviders } from "../../test/render";
import { DisplayToolbar } from "./DisplayToolbar";

function model(mode: DisplayMode, phase: SessionPhase, patch: Partial<DisplayPageModel> = {}): DisplayPageModel {
  return {
    mode,
    session: { ...INITIAL_SESSION, phase },
    vnc: new VncSession(null),
    host: document.createElement("div"),
    badge: badge(mode, phase),
    meta: "1600×900 · 44% · TheOne theone-sandbox",
    enabled: enabledActions(mode, phase),
    empty: emptyModel(mode, null, null, null),
    overlay: null,
    picture: null,
    scale: 0.44,
    fit: true,
    viewOnly: false,
    clipboardSync: true,
    windowsOpen: false,
    windows: { windows: null, error: null, busy: false, refresh: vi.fn(), activate: vi.fn(), close: vi.fn() },
    fullscreen: { fullscreen: false, revealed: false, enter: vi.fn(), exit: vi.fn(), toggle: vi.fn(), onPointerMove: vi.fn() },
    canvasFocused: false,
    setFit: vi.fn(),
    setViewOnly: vi.fn(),
    setClipboardSync: vi.fn(),
    setWindowsOpen: vi.fn(),
    sendKeys: vi.fn(),
    reconnect: vi.fn(),
    checkAgain: vi.fn(),
    runOverlayAction: vi.fn(),
    saveScreenshot: vi.fn(),
    openInBrowser: vi.fn(),
    canvasTakesEscape: () => false,
    ...patch,
  };
}

const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("DisplayToolbar", () => {
  it("shows the live badge, meta and every action in the wide layout", () => {
    renderWithProviders(<DisplayToolbar model={model("viewer", "connected")} compact={false} />);
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("1600×900 · 44% · TheOne theone-sandbox")).toBeTruthy();
    expect(button("Sync clipboard with the sandbox").getAttribute("aria-pressed")).toBe("true");
    expect(button("Send keys").disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Scale the display to the window" }).getAttribute("aria-checked")).toBe("true");
  });

  it("hides secondary actions behind the overflow menu when compact", () => {
    renderWithProviders(<DisplayToolbar model={model("viewer", "connected")} compact />);
    expect(screen.queryByRole("button", { name: "View only (ignore mouse and keyboard)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save a screenshot" })).toBeNull();
    expect(button("More actions")).toBeTruthy();
    expect(button("Reconnect")).toBeTruthy();
    expect(button("Fullscreen (F11)")).toBeTruthy();
  });

  it("disables everything offline and only reconnect while checking", () => {
    const { unmount } = renderWithProviders(<DisplayToolbar model={model("offline", "idle", { meta: "" })} compact={false} />);
    expect(screen.getByText("Offline")).toBeTruthy();
    expect(button("Reconnect").disabled).toBe(true);
    expect(button("Open windows").disabled).toBe(true);
    unmount();
    renderWithProviders(<DisplayToolbar model={model("loading", "idle", { meta: "" })} compact={false} />);
    expect(button("Reconnect").disabled).toBe(false);
    expect(button("Fullscreen (F11)").disabled).toBe(true);
  });

  it("switches scale and toggles view only", () => {
    const view = model("viewer", "connected");
    renderWithProviders(<DisplayToolbar model={view} compact={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "Show the display pixel for pixel" }));
    expect(view.setFit).toHaveBeenCalledWith(false);
    fireEvent.click(button("View only (ignore mouse and keyboard)"));
    expect(view.setViewOnly).toHaveBeenCalledWith(true);
    fireEvent.click(button("Fullscreen (F11)"));
    expect(view.fullscreen.enter).toHaveBeenCalled();
  });

  it("keeps keys disabled until connected", () => {
    renderWithProviders(<DisplayToolbar model={model("viewer", "retrying")} compact={false} />);
    expect(screen.getByText("Reconnecting")).toBeTruthy();
    expect(button("Send keys").disabled).toBe(true);
    expect(button("Open windows").disabled).toBe(false);
  });
});
