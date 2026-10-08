import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSettingsFixture, settingsFixtures } from "../../../fixtures/app-settings/ipc";
import { overrideIpcFixtures } from "../../../fixtures/registry";
import { skipMotionDuringTests } from "../../../onboarding/shell/test-motion";
import { renderRoutes } from "../../../test/render";
import HostShellPreferences from "./HostShellPreferences";

const restores: (() => void)[] = [];
const EXTERNAL = "Running outside Tesseract · https://archlinux.tail511d9d.ts.net:8443";

skipMotionDuringTests();

beforeEach(() => {
  resetSettingsFixture();
  restores.push(overrideIpcFixtures(settingsFixtures));
});

afterEach(() => {
  restores.splice(0).forEach((restore) => restore());
});

function render() {
  return renderRoutes([{ path: "*", element: <HostShellPreferences /> }], "/overview?preferences=host-shell");
}

function switchFor(title: string): HTMLElement {
  const row = screen.getByText(title).closest("[class*=row]") as HTMLElement;
  return within(row).getByRole("switch");
}

describe("HostShellPreferences", () => {
  it("shows an external daemon as on but locked", async () => {
    render();
    expect(await screen.findByText(EXTERNAL)).toBeTruthy();
    const serve = switchFor("Serve host shell");
    expect(serve.getAttribute("aria-checked")).toBe("true");
    expect((serve as HTMLButtonElement).disabled || serve.getAttribute("aria-disabled") === "true").toBe(true);
    expect(screen.getByText("Set · phones unlock with it")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change…" })).toBeTruthy();
  });

  it("saves the autostart switch", async () => {
    const setAutostart = vi.fn((autostart: boolean) => ({ ...settingsFixtures.hostShell!.state!(), autostart }) as never);
    restores.push(overrideIpcFixtures({ hostShell: { setAutostart } }));
    render();
    await screen.findByText(EXTERNAL);
    fireEvent.click(switchFor("Start with Tesseract"));
    await waitFor(() => expect(setAutostart).toHaveBeenCalledWith(true));
  });

  it("rotates the token after confirming", async () => {
    const rotateToken = vi.fn(() => settingsFixtures.hostShell!.state!() as never);
    restores.push(overrideIpcFixtures({ hostShell: { rotateToken } }));
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Rotate…" }));
    expect(await screen.findByText("Rotate the host token?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rotate" }));
    await waitFor(() => expect(rotateToken).toHaveBeenCalledTimes(1));
  });

  it("opens the PIN dialog", async () => {
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Change…" }));
    expect(await screen.findByText("Host shell PIN")).toBeTruthy();
  });
});
