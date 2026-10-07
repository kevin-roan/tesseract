import { act, fireEvent, screen, within } from "@testing-library/react";
import type { BuildJob, Project } from "@theone/protocol";
import { sampleBuild, sampleProject } from "@theone/protocol/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, fakeHost, renderTab, type FakeClient } from "../kit/testing";

let client: FakeClient = fakeClient();

vi.mock("../../../../app/connection", async (importOriginal) => {
  const { connectionMock } = await import("../kit/mock-connection");
  return connectionMock(await importOriginal(), () => client);
});

const { BuildsTab } = await import("./BuildsTab");

const project: Project = { ...sampleProject, id: "hybrid-pos", buildTargets: ["electron-linux", "electron-windows", "script"] };
const build = (patch: Partial<BuildJob>): BuildJob => ({ ...sampleBuild, projectId: "hybrid-pos", ...patch });

describe("BuildsTab", () => {
  beforeEach(() => {
    client = fakeClient();
  });

  it("lists targets with profile chips and the empty builds group", () => {
    renderTab(<BuildsTab project={project} builds={[]} host={fakeHost("hybrid-pos")} />);
    expect(screen.getByText("Linux AppImage")).toBeTruthy();
    expect(screen.getByText("Electron + wine · electron-windows")).toBeTruthy();
    expect(screen.getByText("Logs only · script")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Build" })).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Debug" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("No builds yet.")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("hides the chips when no targets were detected", () => {
    renderTab(<BuildsTab project={{ ...project, buildTargets: [] }} builds={[]} host={fakeHost("hybrid-pos")} />);
    expect(screen.getByText("No build targets detected for this project.")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("starts a build with the selected profile and follows its logs", async () => {
    const started = build({ id: "bld_new", target: "electron-windows", profile: "release", state: "queued" });
    client.startBuild = vi.fn(async () => started);
    const host = fakeHost("hybrid-pos");
    renderTab(<BuildsTab project={project} builds={[]} host={host} />);
    fireEvent.click(screen.getByRole("radio", { name: "Release" }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Build" })[1] as HTMLElement);
    });
    expect(client.startBuild).toHaveBeenCalledWith({ projectId: "hybrid-pos", target: "electron-windows", profile: "release" });
    expect(host.upsert).toHaveBeenCalledWith("build", started);
    expect(client.openBuildLogs).toHaveBeenCalledWith("bld_new", expect.anything(), expect.anything());
  });

  it("shows running builds with progress and cancels after confirming", async () => {
    const running = build({ id: "b1", state: "running", progress: 0.5, stage: "package", target: "electron-linux", profile: "debug" });
    client.cancelBuild = vi.fn(async () => ({ ...running, state: "cancelled" as const }));
    const host = fakeHost("hybrid-pos");
    renderTab(<BuildsTab project={project} builds={[running]} host={host} />);
    const list = screen.getByRole("list", { name: "Builds" });
    expect(within(list).getByRole("progressbar")).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: "Cancel build" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel this build?" });
    expect(within(dialog).getByText("Linux AppImage (Debug) stops and its outputs are discarded.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel Build" }));
    });
    expect(client.cancelBuild).toHaveBeenCalledWith("b1");
    expect(host.upsert).toHaveBeenCalledWith("build", expect.objectContaining({ state: "cancelled" }));
  });

  it("offers Fix with AI for failed builds", () => {
    renderTab(<BuildsTab project={project} builds={[build({ id: "b2", state: "failed", error: "boom" })]} host={fakeHost("hybrid-pos")} />);
    expect(screen.getByText("boom")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fix with AI" })).toBeTruthy();
  });
});
