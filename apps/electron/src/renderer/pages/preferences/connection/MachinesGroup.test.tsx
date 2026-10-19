import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionSnapshot, SavedMachine } from "../../../../shared/contracts/connection";
import { renderRoutes } from "../../../test/render";

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
const snapshot = (): ConnectionSnapshot => ({ config: null, configFile: "/tmp/config.json", machines: [LOCAL, REMOTE] });

const actions = {
  refresh: vi.fn(),
  rediscover: vi.fn(),
  save: vi.fn(),
  forget: vi.fn(),
  switchTo: vi.fn(async () => snapshot()),
  rename: vi.fn(async () => snapshot()),
  remove: vi.fn(async () => snapshot()),
  add: vi.fn(async () => snapshot()),
  setHostLink: vi.fn(async () => snapshot()),
  refreshStatus: vi.fn(async () => snapshot()),
};

vi.mock("../../../app/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useConnectionActions: () => actions,
  useSavedMachines: () => [LOCAL, REMOTE],
  useConnectionStatus: () => "online",
}));

const { MachinesGroup } = await import("./MachinesGroup");
const { useMachineDialogs } = await import("../../../features/machines");

const renderGroup = () => renderRoutes([{ path: "*", element: <MachinesGroup /> }], "/");

describe("MachinesGroup", () => {
  beforeEach(() => {
    Object.values(actions).forEach((mock) => mock.mockClear());
    act(() => useMachineDialogs.getState().close());
  });

  it("lists machines and refreshes their status on open", async () => {
    renderGroup();
    expect(screen.getByText("This computer")).toBeTruthy();
    expect(screen.getByText("127.0.0.1:7700 · Online · No host linked")).toBeTruthy();
    expect(screen.getByText("mac.ts.net:7700 · Offline · Host linked: studio")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    await waitFor(() => expect(actions.refreshStatus).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(actions.refreshStatus).toHaveBeenCalledTimes(2));
  });

  it("switches to another machine", async () => {
    renderGroup();
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    await waitFor(() => expect(actions.switchTo).toHaveBeenCalledWith(REMOTE.id));
  });

  it("offers host and remove actions per machine", async () => {
    renderGroup();
    fireEvent.click(screen.getByRole("button", { name: "More actions for mac" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Unlink host" }));
    await waitFor(() => expect(actions.setHostLink).toHaveBeenCalledWith(REMOTE.id, null));
    fireEvent.click(screen.getByRole("button", { name: "More actions for mac" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Replace host link…" }));
    expect(useMachineDialogs.getState().dialog).toEqual({ kind: "host-link", id: REMOTE.id });
    fireEvent.click(screen.getByRole("button", { name: "More actions for This computer" }));
    const remove = await screen.findByRole("menuitem", { name: "Remove…" });
    expect((remove as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("menuitem", { name: "Switch" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Link host…" })).toBeNull();
  });

  it("opens the add dialog", () => {
    renderGroup();
    fireEvent.click(screen.getByRole("button", { name: "Add Tesseract…" }));
    expect(useMachineDialogs.getState().dialog).toEqual({ kind: "add" });
  });
});
