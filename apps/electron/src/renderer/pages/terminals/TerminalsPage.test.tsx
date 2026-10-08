import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_SHELL_ID, resetFixtureTerminals } from "../../fixtures/terminals/data";
import { SCENARIOS } from "../../fixtures/terminals/http";
import { terminalSessions } from "../../features/terminals/sessions";
import { useTerminalsUi } from "../../features/terminals/store";
import type { TerminalHost } from "../../features/terminals/xterm-host";
import { renderRoutes } from "../../test/render";
import TerminalsPage from "./TerminalsPage";

const written = new Map<string, string[]>();
let created = 0;

function fakeHost(): TerminalHost {
  const id = `host-${(created += 1)}`;
  const output: string[] = [];
  written.set(id, output);
  return {
    element: document.createElement("div"),
    mount: vi.fn(),
    unmount: vi.fn(),
    refit: vi.fn(),
    focus: vi.fn(),
    grid: () => ({ cols: 80, rows: 24 }),
    write: (data) => output.push(data),
    reset: () => output.splice(0),
    setInputEnabled: vi.fn(),
    setScheme: vi.fn(),
    run: vi.fn(),
    hasSelection: () => false,
    mouseTracking: () => false,
    dispose: vi.fn(),
  };
}

function renderPage(path = "/terminals") {
  return renderRoutes([{ path: "/:pageId/*", element: <TerminalsPage /> }], path);
}

function setScenario(name: string | null) {
  window.history.replaceState(null, "", name ? `/?scenario=${name}` : "/");
}

const allOutput = () => [...written.values()].flat().join("");

describe("TerminalsPage", () => {
  let skip: boolean | undefined;
  let restoreFactory: () => void;
  beforeAll(() => {
    skip = MotionGlobalConfig.skipAnimations;
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = skip;
  });
  beforeEach(() => {
    restoreFactory = terminalSessions.setHostFactory(fakeHost);
  });
  afterEach(() => {
    terminalSessions.reset();
    useTerminalsUi.getState().reset();
    restoreFactory();
    resetFixtureTerminals();
    written.clear();
    setScenario(null);
  });

  it("lists sessions with the running count and the placeholder", async () => {
    renderPage();
    expect(await screen.findByText("Shell · Workspace")).toBeTruthy();
    expect(screen.getByText("Claude Code · streaxfit")).toBeTruthy();
    expect(screen.getByText("Sessions")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(/started 4h ago · 49×18/)).toBeTruthy();
    expect(screen.getByText("No session selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New shell" })).toBeTruthy();
  });

  it("attaches to a session and streams its output", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Shell · Workspace"));
    expect(await screen.findByText("Live")).toBeTruthy();
    await waitFor(() => expect(allOutput()).toContain("dev@tesseract-sandbox"));
    expect(screen.getByRole("button", { name: "Close session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Terminal actions" })).toBeTruthy();
    expect(screen.queryByText("No session selected")).toBeNull();
  });

  it("attaches from the sub-route", async () => {
    renderPage(`/terminals/${FIXTURE_SHELL_ID}`);
    expect(await screen.findByText("Live")).toBeTruthy();
    expect(useTerminalsUi.getState().selectedId).toBe(FIXTURE_SHELL_ID);
  });

  it("shows the exit banner and restarts the session", async () => {
    setScenario(SCENARIOS.exited);
    renderPage(`/terminals/${FIXTURE_SHELL_ID}`);
    expect(await screen.findByText("Session ended")).toBeTruthy();
    expect(screen.getByText("The process exited with code 1.")).toBeTruthy();
    expect(screen.getByText("Exited (1)")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Restart" })[0]!);
    await waitFor(() => expect(useTerminalsUi.getState().selectedId).toMatch(/^trm_fixture_new_/));
  });

  it("starts a new shell from the placeholder", async () => {
    renderPage();
    await screen.findByText("Shell · Workspace");
    fireEvent.click(screen.getByRole("button", { name: "New shell" }));
    await waitFor(() => expect(useTerminalsUi.getState().selectedId).toBe("trm_fixture_new_1"));
    expect(screen.getAllByText("Shell · Workspace")).toHaveLength(3);
  });

  it("confirms before terminating a running session", async () => {
    renderPage();
    await screen.findByText("Claude Code · streaxfit");
    fireEvent.click(screen.getAllByRole("button", { name: "Terminate and delete session" })[1]!);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Claude Code · streaxfit and everything running in it will be terminated.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Terminate & Delete" }));
    await waitFor(() => expect(screen.queryByText("Claude Code · streaxfit")).toBeNull());
  });

  it("shows the empty sidebar", async () => {
    setScenario(SCENARIOS.empty);
    renderPage();
    expect(await screen.findByText("No sessions")).toBeTruthy();
  });
});
