import { fireEvent, screen, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/render";
import { EMPTY_SYNC_VIEW, syncConflicts, type SyncView } from "../model";
import { SyncReviewDialog } from "./SyncReviewDialog";

MotionGlobalConfig.skipAnimations = true;

const changes = [
  { path: "src/a.ts", kind: "modified" as const, sha256: "a".repeat(64), size: 10 },
  { path: "src/b.ts", kind: "added" as const, sha256: "b".repeat(64), size: 20 },
];

const view = (conflicts: string[]): SyncView => ({
  ...EMPTY_SYNC_VIEW,
  link: { projectId: "p", hostPath: "/home/dev/p", pushedAt: "2026-09-23T10:00:00Z", gotAt: null, confidential: false, files: 2 },
  changes: { projectId: "p", baselineAt: "2026-09-23T10:00:00Z", changes, totalBytes: 30, host: null },
  conflicts,
});

describe("SyncReviewDialog", () => {
  it("forces the pull when host files were edited since the push", () => {
    const onConfirm = vi.fn();
    const conflicts = syncConflicts(changes, [{ path: "src/a.ts", kind: "modified" }]);
    renderWithProviders(<SyncReviewDialog projectId="p" view={view(conflicts)} open onClose={vi.fn()} onConfirm={onConfirm} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("1 file changed on this computer since the push and will be overwritten.")).toBeTruthy();
    expect(within(dialog).getAllByText("Host edit").length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Overwrite and Sync" }));
    expect(onConfirm).toHaveBeenCalledWith(true, ["src/a.ts", "src/b.ts"]);
  });

  it("syncs without force when nothing conflicts", () => {
    const onConfirm = vi.fn();
    renderWithProviders(<SyncReviewDialog projectId="p" view={view([])} open onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sync 2 files" }));
    expect(onConfirm).toHaveBeenCalledWith(false, ["src/a.ts", "src/b.ts"]);
  });
});
