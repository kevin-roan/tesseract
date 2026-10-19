import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { buildPairingLink, HOST_PAIRING_ACTION } from "@tesseract/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionSnapshot, SavedMachine } from "../../../shared/contracts/connection";
import { IpcError } from "../../../shared/ipc-types";
import { renderRoutes } from "../../test/render";

const LOCAL: SavedMachine = { id: "http://127.0.0.1:7700", apiUrl: "http://127.0.0.1:7700", name: null, active: true, local: true, status: "online", host: null };
const REMOTE: SavedMachine = { id: "https://mac.ts.net:7700", apiUrl: "https://mac.ts.net:7700", name: "mac", active: false, local: false, status: "offline", host: null };
const HOST_LINK = buildPairingLink({ url: "https://mac.ts.net:7701", token: "host-token", name: "mac" }, HOST_PAIRING_ACTION);
const snapshot = (machines: SavedMachine[]): ConnectionSnapshot => ({ config: null, configFile: "/tmp/config.json", machines });

const actions = {
  refresh: vi.fn(),
  rediscover: vi.fn(),
  save: vi.fn(),
  forget: vi.fn(),
  switchTo: vi.fn(async () => snapshot([LOCAL, REMOTE])),
  rename: vi.fn(async () => snapshot([LOCAL, REMOTE])),
  remove: vi.fn(async () => snapshot([LOCAL])),
  add: vi.fn(async () => snapshot([LOCAL, REMOTE])),
  setHostLink: vi.fn(async () => snapshot([LOCAL, REMOTE])),
  refreshStatus: vi.fn(async () => snapshot([LOCAL, REMOTE])),
};

vi.mock("../../app/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useConnectionActions: () => actions,
  useSavedMachines: () => [LOCAL, REMOTE],
  useConnectionStatus: () => "online",
}));

const { MachineDialogs } = await import("./MachineDialogs");
const { openMachineDialog, useMachineDialogs } = await import("../../features/machines");

function renderDialogs() {
  return renderRoutes([{ path: "*", element: <MachineDialogs /> }], "/");
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

describe("machine dialogs", () => {
  beforeEach(() => {
    Object.values(actions).forEach((mock) => mock.mockClear());
    act(() => useMachineDialogs.getState().close());
  });

  it("validates the add form inline before calling main", async () => {
    renderDialogs();
    act(() => openMachineDialog({ kind: "add" }));
    await screen.findByText("Add a Tesseract");
    type("Pairing link or address", "https://mac.ts.net:7700");
    type("Host link", "tesseract://pair?url=x");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Enter the sandbox token.")).toBeTruthy();
    expect(screen.getByText("Paste a tesseract://host link, or leave the field empty.")).toBeTruthy();
    expect(actions.add).not.toHaveBeenCalled();
  });

  it("adds a machine with its host link without switching", async () => {
    renderDialogs();
    act(() => openMachineDialog({ kind: "add" }));
    await screen.findByText("Add a Tesseract");
    type("Pairing link or address", "https://mac.ts.net:7700");
    type("Token", "secret");
    type("Host link", HOST_LINK);
    type("Name", "mac");
    fireEvent.click(screen.getByRole("checkbox", { name: "Switch to it now" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(actions.add).toHaveBeenCalledWith(
        { apiUrl: "https://mac.ts.net:7700", token: "secret", name: "mac", pairingUrl: null },
        { hostLink: HOST_LINK, activate: false },
      ),
    );
    await waitFor(() => expect(useMachineDialogs.getState().dialog).toBeNull());
  });

  it("shows errors from main inside the dialog", async () => {
    actions.add.mockRejectedValueOnce(new IpcError("invalid_argument", "That sandbox did not answer"));
    renderDialogs();
    act(() => openMachineDialog({ kind: "add" }));
    await screen.findByText("Add a Tesseract");
    type("Pairing link or address", "https://mac.ts.net:7700");
    type("Token", "secret");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("That sandbox did not answer")).toBeTruthy();
    expect(useMachineDialogs.getState().dialog).toEqual({ kind: "add" });
  });

  it("links a host to a machine", async () => {
    renderDialogs();
    act(() => openMachineDialog({ kind: "host-link", id: REMOTE.id }));
    await screen.findByText("Link host");
    type("Host link", HOST_LINK);
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    await waitFor(() => expect(actions.setHostLink).toHaveBeenCalledWith(REMOTE.id, HOST_LINK));
  });

  it("confirms before removing a remote machine and never offers it for this computer", async () => {
    renderDialogs();
    act(() => openMachineDialog({ kind: "remove", id: LOCAL.id }));
    expect(screen.queryByText("Remove This computer?")).toBeNull();
    act(() => openMachineDialog({ kind: "remove", id: REMOTE.id }));
    await screen.findByText("Remove mac?");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith(REMOTE.id));
  });
});
