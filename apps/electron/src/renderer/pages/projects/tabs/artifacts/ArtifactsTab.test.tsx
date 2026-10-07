import { act, fireEvent, screen, within } from "@testing-library/react";
import { ApiError } from "@theone/client";
import type { Artifact } from "@theone/protocol";
import { sampleArtifact } from "@theone/protocol/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetFilesStore } from "../../../../features/files/store";
import { fakeClient, fakeHost, renderTab, type FakeClient } from "../kit/testing";

let client: FakeClient = fakeClient();

vi.mock("../../../../app/connection", async (importOriginal) => {
  const { connectionMock } = await import("../kit/mock-connection");
  return connectionMock(await importOriginal(), () => client);
});

vi.mock("../../../../app/data", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useApiClient: () => client,
}));

const { ArtifactsTab } = await import("./ArtifactsTab");

const artifact = (patch: Partial<Artifact>): Artifact => ({ ...sampleArtifact, projectId: "monolith", ...patch });

describe("ArtifactsTab", () => {
  beforeEach(() => {
    client = fakeClient();
  });

  afterEach(() => {
    resetFilesStore();
  });

  it("shows the empty state", () => {
    renderTab(<ArtifactsTab artifacts={[]} host={fakeHost()} />);
    expect(screen.getByText("No artifacts yet")).toBeTruthy();
    expect(screen.getByText("Successful builds and files Claude shares put their outputs here.")).toBeTruthy();
  });

  it("lists artifacts newest first with the Claude badge", () => {
    renderTab(
      <ArtifactsTab
        artifacts={[
          artifact({ id: "a", fileName: "old.apk", createdAt: "2026-09-20T00:00:00Z" }),
          artifact({ id: "b", fileName: "notes.md", source: "agent", note: " Summary ", createdAt: "2026-09-23T00:00:00Z" }),
        ]}
        host={fakeHost()}
      />,
    );
    const rows = within(screen.getByRole("list", { name: "Artifacts" })).getAllByRole("listitem");
    expect(rows[0]?.textContent).toContain("notes.md");
    expect(rows[0]?.textContent).toContain("Summary");
    expect(screen.getByText("Shared by Claude")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send to device" })).toBeNull();
  });

  it("deletes after confirming and removes the row", async () => {
    client.deleteArtifact = vi.fn(async () => artifact({ id: "a" }));
    const host = fakeHost();
    renderTab(<ArtifactsTab artifacts={[artifact({ id: "a", fileName: "app.exe" })]} host={host} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete app.exe?" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    });
    expect(client.deleteArtifact).toHaveBeenCalledWith("a");
    expect(host.remove).toHaveBeenCalledWith("artifact", "a");
  });

  it("removes silently when the file is already gone", async () => {
    client.deleteArtifact = vi.fn(async () => {
      throw new ApiError(404, "not_found", "gone");
    });
    const host = fakeHost();
    renderTab(<ArtifactsTab artifacts={[artifact({ id: "a", fileName: "app.exe" })]} host={host} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    });
    expect(host.remove).toHaveBeenCalledWith("artifact", "a");
    expect(host.report).not.toHaveBeenCalled();
  });

  it("sends to an online Taildrop device", async () => {
    client.taildropTargets = vi.fn(async () => ({
      available: true,
      targets: [{ id: "p8", hostName: "pixel-8", dnsName: null, os: "android", online: true }],
    }));
    client.sendArtifactToTaildrop = vi.fn(async () => artifact({ id: "a" }));
    renderTab(<ArtifactsTab artifacts={[artifact({ id: "a", fileName: "app.apk" })]} host={fakeHost()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Send to device" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Send app.apk" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Device|Send to/ }));
    expect(screen.getByRole("option", { name: "pixel-8 · android" })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "pixel-8 · android" }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    });
    expect(client.sendArtifactToTaildrop).toHaveBeenCalledWith("a", { targetId: "p8" }, expect.anything());
  });

  it("saves through the native save picker", async () => {
    const picker = vi.fn(async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    Object.assign(globalThis, { showSaveFilePicker: picker });
    const host = fakeHost();
    renderTab(<ArtifactsTab artifacts={[artifact({ id: "a", fileName: "app.apk" })]} host={host} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save…" }));
    });
    expect(picker).toHaveBeenCalledWith({ suggestedName: "app.apk" });
    expect(host.report).not.toHaveBeenCalled();
    Reflect.deleteProperty(globalThis, "showSaveFilePicker");
  });
});
