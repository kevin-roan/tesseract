import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished } from "vitest";
import { sampleSimDevice } from "@tesseract/protocol/fixtures";
import { useToastStore } from "../../components/Toast";
import { bootHostSimulator, hostFixtureState, resetHostFixtures } from "../../fixtures/host/data";
import { overrideIpcFixtures } from "../../fixtures/registry";
import { resetFixtureRuntime } from "../../fixtures/processes/data";
import { renderRoutes } from "../../test/render";
import ProcessesPage from "./ProcessesPage";

function renderPage() {
  return renderRoutes([{ path: "/:pageId/*", element: <ProcessesPage /> }], "/processes");
}

function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest("[role='listitem'], li") as HTMLElement | null;
  if (!row) throw new Error(`No row for ${text}`);
  return row;
}

describe("ProcessesPage", () => {
  let skip: boolean | undefined;
  beforeAll(() => {
    skip = MotionGlobalConfig.skipAnimations;
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = skip;
  });
  afterEach(() => {
    resetFixtureRuntime();
    resetHostFixtures();
  });

  it("groups running things by kind", async () => {
    renderPage();
    expect(await screen.findByText("bun run dev")).toBeTruthy();
    for (const heading of ["Processes", "App runs", "Agents", "Terminals", "Browser", "Display / VNC"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(screen.getByText(/PID 2311/)).toBeTruthy();
    expect(screen.getAllByText(/Supervised — will restart/).length).toBe(2);
  });

  it("stops an entry with SIGTERM", async () => {
    renderPage();
    await screen.findByText("bun run dev");
    fireEvent.click(within(rowOf("bun run dev")).getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(screen.queryByText("bun run dev")).toBeNull());
    expect(useToastStore.getState().queue.some((toast) => toast.message === "Sent stop to dev")).toBe(true);
  });

  it("asks before a force kill", async () => {
    renderPage();
    await screen.findByText("Chromium");
    fireEvent.click(within(rowOf("Chromium")).getByRole("button", { name: "Force kill" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/supervised, so the sandbox will start it again/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Force kill" }));
    await waitFor(() => expect(screen.queryByText("Chromium")).toBeNull());
    expect(useToastStore.getState().queue.some((toast) => toast.message === "Killed Chromium")).toBe(true);
  });

  it("lists a booted iOS simulator under host devices and force-kills it", async () => {
    bootHostSimulator(sampleSimDevice.udid);
    const host = hostFixtureState();
    const restore = overrideIpcFixtures({ hostShell: { state: () => host } });
    onTestFinished(restore);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Host devices" })).toBeTruthy();
    const row = rowOf(sampleSimDevice.name);
    expect(within(row).getByText("iOS Simulator · iOS 26.0")).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: "Force kill" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Force kill" }));
    await waitFor(() => expect(screen.queryByText(sampleSimDevice.name)).toBeNull());
    expect(useToastStore.getState().queue.some((toast) => toast.message === `Killed ${sampleSimDevice.name}`)).toBe(true);
  });
});
