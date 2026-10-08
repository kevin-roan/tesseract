import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { RunTargetInfo } from "@tesseract/protocol";
import { MotionGlobalConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { overrideIpcFixtures } from "../../../../fixtures";
import { renderRoutes } from "../../../../test/render";
import { EmulatorButton, type EmulatorButtonProps } from "./EmulatorButton";

MotionGlobalConfig.skipAnimations = true;

const android: RunTargetInfo = {
  target: "expo-android",
  label: "Android emulator",
  dir: null,
  available: false,
  reason: "Start the emulator on the host",
  viewer: "android",
  actions: [],
};

function renderButton(props: Partial<EmulatorButtonProps>) {
  const report = vi.fn();
  const element = (
    <EmulatorButton projectId="streaxfit" projectName="streaxfit" framework="expo" runTargets={[android]} appRuns={[]} report={report} {...props} />
  );
  renderRoutes([{ path: "*", element }], "/projects/streaxfit");
  return report;
}

describe("EmulatorButton", () => {
  it("shows Display for other frameworks", () => {
    renderButton({ framework: "next", runTargets: [] });
    expect(screen.getByRole("button", { name: "Display" })).toBeTruthy();
  });

  it("reports a host blocker with a Preferences action", async () => {
    const restore = overrideIpcFixtures({
      hostShell: {
        state: () => ({ status: "stopped", pairing: null, error: null, log: [], autostart: false, sessionExpiresAt: null }),
        refresh: () => ({ status: "stopped", pairing: null, error: null, log: [], autostart: false, sessionExpiresAt: null }),
      },
    });
    const report = renderButton({});
    fireEvent.click(screen.getByRole("button", { name: "Open on emulator" }));
    await waitFor(() => expect(report).toHaveBeenCalled());
    const [error, action] = report.mock.calls[0] ?? [];
    expect((error as Error).message).toMatch(/^The host shell isn't running/);
    expect(action.label).toBe("Preferences");
    restore();
  });

  it("asks for the PIN, then prepares the emulator and opens the viewer", async () => {
    const viewer = vi.fn();
    const restore = overrideIpcFixtures({ hostShell: { openEmulatorViewer: viewer } });
    const onRun = vi.fn();
    const report = renderButton({ onRun });
    fireEvent.click(screen.getByRole("button", { name: "Open on emulator" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/PIN/i), { target: { value: "123456" } });
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(onRun).toHaveBeenCalled(), { timeout: 8000 });
    await waitFor(() => expect(viewer).toHaveBeenCalledWith({ serial: expect.any(String), title: "streaxfit · Android emulator" }));
    expect(report).not.toHaveBeenCalled();
    restore();
  }, 15000);
});
