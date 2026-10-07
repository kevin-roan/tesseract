import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ProcessInfo, Project } from "@theone/protocol";
import { sampleProcess, sampleProject } from "@theone/protocol/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, fakeHost, renderTab, type FakeClient } from "../kit/testing";

let client: FakeClient = fakeClient();

vi.mock("../../../../app/connection", async (importOriginal) => {
  const { connectionMock } = await import("../kit/mock-connection");
  return connectionMock(await importOriginal(), () => client);
});

const { ProcessesTab } = await import("./ProcessesTab");

const project: Project = { ...sampleProject, id: "monolith", name: "monolith", framework: "vite", packageManager: "pnpm", scripts: ["dev", "build"] };
const process = (patch: Partial<ProcessInfo>): ProcessInfo => ({ ...sampleProcess, projectId: "monolith", ...patch });

describe("ProcessesTab", () => {
  beforeEach(() => {
    client = fakeClient({
      ports: vi.fn(async () => ({
        tailscaleIp: null,
        ports: [
          { port: 41769, pid: 2, command: "java", processId: null, projectId: "monolith", url: "http://100.116.96.29:41769", dnsUrl: null },
          { port: 41653, pid: 1, command: "java", processId: null, projectId: "monolith", url: "http://100.116.96.29:41653", dnsUrl: null },
          { port: 9, pid: 3, command: "x", processId: null, projectId: "other", url: null, dnsUrl: null },
        ],
      })),
    });
  });

  it("shows ports, processes and scripts in order", async () => {
    const processes = [
      process({ id: "a", name: "old", state: "exited", exitCode: 0, startedAt: "2026-09-23T08:00:00Z", endedAt: "2026-09-23T08:01:00Z" }),
      process({ id: "b", name: "server", state: "running", startedAt: "2026-09-23T07:00:00Z" }),
    ];
    renderTab(<ProcessesTab project={project} processes={processes} host={fakeHost()} />);
    await screen.findByText(":41653");
    const portRows = within(screen.getByRole("list", { name: "Listening ports" })).getAllByRole("listitem");
    expect(portRows.map((row) => row.textContent)).toEqual([expect.stringContaining(":41653"), expect.stringContaining(":41769")]);
    const processRows = within(screen.getByRole("list", { name: "Processes" })).getAllByRole("listitem");
    expect(processRows[0]?.textContent).toContain("server");
    expect(screen.getByText("pnpm run dev")).toBeTruthy();
    expect(screen.getByText("Package scripts run with pnpm")).toBeTruthy();
  });

  it("shows the loading state and the empty label", () => {
    const { unmount } = renderTab(<ProcessesTab project={{ ...project, scripts: [] }} processes={null} host={fakeHost()} />);
    expect(screen.queryByText("Nothing has run in this project yet.")).toBeNull();
    expect(screen.queryByText("Scripts")).toBeNull();
    unmount();
    renderTab(<ProcessesTab project={project} processes={[]} host={fakeHost()} />);
    expect(screen.getByText("Nothing has run in this project yet.")).toBeTruthy();
  });

  it("opens and closes the log panel for a process", async () => {
    renderTab(<ProcessesTab project={project} processes={[process({ id: "b", name: "server", state: "running" })]} host={fakeHost()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show logs" }));
    await screen.findByText("Logs · server");
    expect(client.openProcessLogs).toHaveBeenCalledWith("b", expect.anything(), expect.anything());
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide logs" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close logs" }));
    await waitFor(() => expect(screen.queryByText("Logs · server")).toBeNull());
  });

  it("confirms before stopping and upserts the result", async () => {
    const stopped = process({ id: "b", name: "server", state: "stopped" });
    client.stopProcess = vi.fn(async () => stopped);
    const host = fakeHost();
    renderTab(<ProcessesTab project={project} processes={[process({ id: "b", name: "server", state: "running" })]} host={host} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Stop server?" });
    expect(within(dialog).getByText("The process gets SIGTERM, then SIGKILL after 5 seconds.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Stop" }));
    });
    expect(client.stopProcess).toHaveBeenCalledWith("b");
    expect(host.upsert).toHaveBeenCalledWith("process", stopped);
  });

  it("runs a script and follows its logs", async () => {
    const started = process({ id: "n", name: "dev", state: "starting" });
    client.startProcess = vi.fn(async () => started);
    const host = fakeHost();
    renderTab(<ProcessesTab project={project} processes={[]} host={host} />);
    const scripts = screen.getByRole("list", { name: "Scripts" });
    await act(async () => {
      fireEvent.click(within(scripts).getAllByRole("button", { name: "Run" })[0] as HTMLElement);
    });
    expect(client.startProcess).toHaveBeenCalledWith({ projectId: "monolith", command: "pnpm run dev", name: "dev" });
    expect(host.upsert).toHaveBeenCalledWith("process", started);
    await act(async () => {
      fireEvent.click(within(scripts).getAllByRole("button", { name: "Run on display" })[1] as HTMLElement);
    });
    expect(client.startProcess).toHaveBeenLastCalledWith({ projectId: "monolith", command: "pnpm run build", name: "build", display: true });
  });

  it("offers Fix with AI on failed processes", () => {
    renderTab(<ProcessesTab project={project} processes={[process({ id: "f", state: "exited", exitCode: 1 })]} host={fakeHost()} />);
    expect(screen.getByRole("button", { name: "Fix with AI" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("validates and submits the run command dialog", async () => {
    const started = process({ id: "r", name: "custom", state: "running" });
    client.startProcess = vi.fn(async () => started);
    renderTab(<ProcessesTab project={project} processes={[]} host={fakeHost()} />);
    fireEvent.click(screen.getByRole("button", { name: "Run command" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Run" }));
    expect(await within(dialog).findByText("Enter a command to run.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Command"), { target: { value: "ls -la" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Run" }));
    });
    expect(client.startProcess).toHaveBeenCalledWith({ projectId: "monolith", command: "ls -la" });
  });
});
