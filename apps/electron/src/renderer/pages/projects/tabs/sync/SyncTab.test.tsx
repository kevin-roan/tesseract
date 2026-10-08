import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/render";
import { SyncTab } from "./SyncTab";

MotionGlobalConfig.skipAnimations = true;

describe("SyncTab", () => {
  it("shows a linked project without changes", async () => {
    const onCount = vi.fn();
    renderWithProviders(<SyncTab projectId="sante-production" report={vi.fn()} onCount={onCount} />);
    expect(await screen.findByText("Nothing to sync. The host folder matches the sandbox.")).toBeTruthy();
    expect(screen.getByText("/mnt/data/dev/Projects/work/sante-production")).toBeTruthy();
    expect(screen.getByText("No sync requests yet.")).toBeTruthy();
    expect(screen.getByText("No syncs yet.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sync to host" }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByRole("button", { name: "Sync from host" }).getAttribute("data-variant")).toBe("attention"));
    expect(onCount).toHaveBeenLastCalledWith(0);
  });

  it("lists sandbox changes and opens the review", async () => {
    const onCount = vi.fn();
    renderWithProviders(<SyncTab projectId="hybrid-pos" report={vi.fn()} onCount={onCount} />);
    expect(await screen.findByText("12 files · 721 KB")).toBeTruthy();
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(12));
    const pull = screen.getByRole("button", { name: "Sync to host" }) as HTMLButtonElement;
    await waitFor(() => expect(pull.disabled).toBe(false));
    fireEvent.click(pull);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Review sync to host")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Sync 12 files" })).toBeTruthy();
    expect(await within(dialog).findByText("@@ -1,7 +1,9 @@")).toBeTruthy();
  });

  it("shows requests and snapshots", async () => {
    renderWithProviders(<SyncTab projectId="tesseract" report={vi.fn()} />);
    expect(await screen.findByText("Pulled 8 files into /home/dev/code/tesseract (2 added, 5 modified, 1 deleted)")).toBeTruthy();
    expect(screen.getByText("20260923T100500Z")).toBeTruthy();
    expect(screen.getByText("Reverted")).toBeTruthy();
  });

  it("explains that an unlinked project needs tesseract --sync", async () => {
    renderWithProviders(<SyncTab projectId="streaxfit" report={vi.fn()} />);
    expect(await screen.findByText(/^Not linked on this computer/)).toBeTruthy();
  });
});
