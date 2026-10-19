import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SavedMachine } from "../../../shared/contracts/connection";
import { machineRow } from "../../features/machines";
import { MachineMenu } from "./MachineMenu";

const LOCAL: SavedMachine = { id: "http://127.0.0.1:7700", apiUrl: "http://127.0.0.1:7700", name: null, active: true, local: true, status: "online", host: null };
const REMOTE: SavedMachine = {
  id: "https://mac.ts.net:7700",
  apiUrl: "https://mac.ts.net:7700",
  name: "mac",
  active: false,
  local: false,
  status: "offline",
  host: { url: "https://mac.ts.net:7701", name: "studio" },
};
const ANCHOR = { x: 0, y: 0, width: 10, height: 10 };

function renderMenu() {
  const onSwitch = vi.fn();
  const onClose = vi.fn();
  const onAdd = vi.fn();
  render(
    <MachineMenu
      anchor={ANCHOR}
      machines={[LOCAL, REMOTE].map(machineRow)}
      sections={[[{ id: "add", label: "Add Tesseract…", onSelect: onAdd }]]}
      onSwitch={onSwitch}
      onClose={onClose}
      ariaLabel="Tesseracts"
    />,
  );
  return { onSwitch, onClose, onAdd };
}

describe("MachineMenu", () => {
  it("lists machines with status, address, host link and the active check", () => {
    renderMenu();
    const items = screen.getAllByRole("menuitemradio");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("This computer");
    expect(items[0]?.getAttribute("aria-checked")).toBe("true");
    expect(items[1]?.textContent).toContain("mac");
    expect(items[1]?.textContent).toContain("mac.ts.net:7700");
    expect(items[1]?.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("img", { name: "Online" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Offline" })).toBeTruthy();
    expect(screen.getByLabelText("Host linked: studio")).toBeTruthy();
  });

  it("switches and runs actions, closing the menu first", () => {
    const { onSwitch, onClose, onAdd } = renderMenu();
    fireEvent.click(screen.getAllByRole("menuitemradio")[1] as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith(REMOTE.id);
    fireEvent.click(screen.getByRole("menuitem", { name: "Add Tesseract…" }));
    expect(onAdd).toHaveBeenCalled();
  });
});
