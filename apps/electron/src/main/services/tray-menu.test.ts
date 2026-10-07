import { describe, expect, it, vi } from "vitest";
import { TRAY_LABELS } from "../labels";
import { trayIconChoices, trayMenuTemplate, togglesOnClick, type TrayActions } from "./tray-menu";

function actions(): TrayActions {
  return { open: vi.fn(), hide: vi.fn(), command: vi.fn(), installUpdate: vi.fn(), quit: vi.fn() };
}

describe("trayMenuTemplate", () => {
  it("matches the GTK tray menu order", () => {
    const labels = trayMenuTemplate(actions(), { updateReady: null }).map((item) => item.label ?? item.type);
    expect(labels).toEqual([
      "Open Monolith",
      "Hide Window",
      "Refresh",
      "Pair a device…",
      "Pair this computer…",
      "Preferences",
      "separator",
      "Quit Monolith",
    ]);
  });

  it("dispatches the matching commands", () => {
    const spy = actions();
    const items = trayMenuTemplate(spy, { updateReady: null });
    for (const item of items) (item.click as (() => void) | undefined)?.();
    expect(spy.open).toHaveBeenCalledOnce();
    expect(spy.hide).toHaveBeenCalledOnce();
    expect(spy.quit).toHaveBeenCalledOnce();
    expect(vi.mocked(spy.command).mock.calls.map(([command]) => command.type)).toEqual(["refresh", "pair", "pair-host", "preferences"]);
  });

  it("adds a restart item once an update is downloaded", () => {
    const spy = actions();
    const items = trayMenuTemplate(spy, { updateReady: "0.2.0" });
    const restart = items.find((item) => item.label === TRAY_LABELS.restartToUpdate("0.2.0"));
    (restart?.click as (() => void) | undefined)?.();
    expect(spy.installUpdate).toHaveBeenCalledOnce();
    expect(items.at(-1)?.label).toBe(TRAY_LABELS.quit);
  });
});

describe("tray platform rules", () => {
  it("formats the tooltip with the connection status", () => {
    expect(TRAY_LABELS.tooltip("Online")).toBe("Monolith · Online");
    expect(TRAY_LABELS.tooltip("")).toBe("Monolith");
  });

  it("prefers a template icon on macOS", () => {
    expect(trayIconChoices("darwin")[0]).toMatchObject({ template: true, size: 16 });
    expect(trayIconChoices("linux")).toEqual([{ segments: ["icons", "tray.png"], size: 22, template: false }]);
  });

  it("toggles the window on click except on macOS", () => {
    expect(togglesOnClick("linux")).toBe(true);
    expect(togglesOnClick("win32")).toBe(true);
    expect(togglesOnClick("darwin")).toBe(false);
  });
});
