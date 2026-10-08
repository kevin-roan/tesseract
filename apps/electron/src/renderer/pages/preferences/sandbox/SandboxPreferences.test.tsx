import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetupChoices } from "../../../../shared/contracts/sandbox";
import { resetSettingsFixture, settingsFixtures } from "../../../fixtures/app-settings/ipc";
import { SANDBOX_STACK } from "../../../fixtures/app-settings/data";
import { overrideIpcFixtures } from "../../../fixtures/registry";
import { skipMotionDuringTests } from "../../../onboarding/shell/test-motion";
import { renderRoutes } from "../../../test/render";
import { SANDBOX_SETTINGS_LABELS as L } from "./labels";
import SandboxPreferences from "./SandboxPreferences";

const restores: (() => void)[] = [];

skipMotionDuringTests();

beforeEach(() => {
  resetSettingsFixture();
  restores.push(overrideIpcFixtures(settingsFixtures));
});

afterEach(() => {
  restores.splice(0).forEach((restore) => restore());
});

function render() {
  return renderRoutes([{ path: "*", element: <SandboxPreferences /> }], "/overview?preferences=sandbox");
}

describe("SandboxPreferences", () => {
  it("shows Docker and the running stack", async () => {
    render();
    expect(await screen.findByText("Docker Engine 28.5.1 · 16 CPUs · 32 GB")).toBeTruthy();
    expect(await screen.findByText("Compose project tesseract · 2 containers")).toBeTruthy();
    expect(screen.getByRole("button", { name: L.stack.stop })).toBeTruthy();
  });

  it("stops the sandbox", async () => {
    const down = vi.fn(() => ({ configured: true, project: "tesseract", services: [] }));
    restores.push(overrideIpcFixtures({ sandbox: { down } }));
    render();
    fireEvent.click(await screen.findByRole("button", { name: L.stack.stop }));
    await waitFor(() => expect(down).toHaveBeenCalledWith(false));
  });

  it("rebuilds with the new components after confirming", async () => {
    const save = vi.fn((choices: SetupChoices) => ({ ...SANDBOX_STACK, components: choices.components }));
    const build = vi.fn(() => ({ kind: "preflight" as const }));
    restores.push(overrideIpcFixtures({ sandbox: { save, build } }));
    render();
    await screen.findByText("Docker Engine 28.5.1 · 16 CPUs · 32 GB");
    expect(screen.queryByText(L.tools.pending)).toBeNull();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Mono" }));
    expect(await screen.findByText(L.tools.pending)).toBeTruthy();
    const rebuild = screen.getByRole("button", { name: L.tools.rebuild });
    await waitFor(() => expect((rebuild as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(rebuild);
    fireEvent.click(await screen.findByRole("button", { name: L.rebuild.confirm }));
    await waitFor(() => expect(build).toHaveBeenCalledWith("build"));
    expect(save.mock.calls[0]?.[0].components).toEqual(["android", "flutter", "mono", "whisper"]);
    expect(await screen.findByText("Checking disk space…")).toBeTruthy();
  });
});
