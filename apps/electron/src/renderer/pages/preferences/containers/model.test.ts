import { describe, expect, it } from "vitest";
import type { CheckItem } from "../../../../shared/contracts/common";
import type { ContainersActionKey } from "../../../../shared/contracts/containers";
import { checkViews, runningTask } from "./model";

const CHECKS: CheckItem<ContainersActionKey>[] = [
  { id: "sysbox", status: "error", title: "Sysbox runtime", detail: "Set up the VM", action: "setup-vm" },
  { id: "image", status: "warning", title: "Server image", detail: "Build it", action: "build-image" },
  { id: "tailscale", status: "ok", title: "Tailscale", detail: "Saved", action: "tailscale-key" },
];

const IDLE = { running: false, step: null };

describe("container checks", () => {
  it("offers the VM setup as a primary inline action", () => {
    const rows = checkViews(CHECKS, { "setup-vm": IDLE, "build-image": IDLE });
    expect(rows.map((row) => [row.action, row.primary])).toEqual([
      ["setup-vm", true],
      ["build-image", true],
      [null, false],
    ]);
  });

  it("shows the running task's progress in its row", () => {
    const tasks = { "setup-vm": { running: true, step: "colima start tesseract" }, "build-image": IDLE };
    const [sysbox, image] = checkViews(CHECKS, tasks);
    expect(sysbox).toMatchObject({ status: "running", subtitle: "colima start tesseract", action: null });
    expect(image).toMatchObject({ status: "warning", action: "build-image" });
    expect(runningTask(tasks)).toBe("setup-vm");
    expect(runningTask({ "setup-vm": IDLE, "build-image": IDLE })).toBeNull();
  });

  it("falls back to a progress label before the first step", () => {
    const [sysbox] = checkViews(CHECKS, { "setup-vm": { running: true, step: null }, "build-image": IDLE });
    expect(sysbox!.subtitle).toBe("Setting up the Tesseract VM…");
  });
});
