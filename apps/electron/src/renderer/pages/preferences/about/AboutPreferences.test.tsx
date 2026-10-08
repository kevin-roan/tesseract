import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSettingsFixture, settingsFixtures } from "../../../fixtures/app-settings/ipc";
import { cliStatus, SETTINGS_SCENARIOS, updateState } from "../../../fixtures/app-settings/data";
import { overrideIpcFixtures } from "../../../fixtures/registry";
import { skipMotionDuringTests } from "../../../onboarding/shell/test-motion";
import { renderRoutes } from "../../../test/render";
import AboutPreferences from "./AboutPreferences";
import { ABOUT_LABELS } from "./labels";

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
  return renderRoutes([{ path: "*", element: <AboutPreferences /> }], "/overview?preferences=about");
}

describe("AboutPreferences", () => {
  it("downloads an available update", async () => {
    const download = vi.fn(() => updateState(SETTINGS_SCENARIOS.updateDownloading));
    restores.push(overrideIpcFixtures({ updates: { state: () => updateState(SETTINGS_SCENARIOS.updateAvailable), download } }));
    render();
    expect(await screen.findByText("Tesseract 0.4.0 is available")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: ABOUT_LABELS.updates.download }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("progressbar")).toBeTruthy();
  });

  it("installs the tesseract command", async () => {
    const installCli = vi.fn(() => cliStatus(SETTINGS_SCENARIOS.cliInstalled));
    restores.push(overrideIpcFixtures({ app: { cliStatus: () => cliStatus(SETTINGS_SCENARIOS.cliMissing), installCli } }));
    render();
    fireEvent.click(await screen.findByRole("button", { name: ABOUT_LABELS.cli.install }));
    await waitFor(() => expect(installCli).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("On your PATH at /usr/bin/tesseract")).toBeTruthy();
  });

  it("lists the app files", async () => {
    const showItemInFolder = vi.fn(() => undefined);
    restores.push(overrideIpcFixtures({ app: { showItemInFolder } }));
    render();
    expect(await screen.findByText("/home/dev/.config/tesseract-desktop/config.json")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: ABOUT_LABELS.files.show })[0]!);
    expect(showItemInFolder).toHaveBeenCalledWith("/home/dev/.config/tesseract-desktop/config.json");
  });
});
