import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetFixtureTerminals } from "../../../fixtures/terminals/data";
import { useTerminalPanelStore } from "../../../features/terminals/panel-store";
import { projectTerminalSessions, useProjectTerminalsUi } from "../../../features/terminals/project-scope";
import type { TerminalHost } from "../../../features/terminals/xterm-host";
import { renderRoutes } from "../../../test/render";
import ProjectsPage from "../ProjectsPage";

MotionGlobalConfig.skipAnimations = true;

const fakeHost = (): TerminalHost => ({
  element: document.createElement("div"),
  mount: vi.fn(),
  unmount: vi.fn(),
  refit: vi.fn(),
  focus: vi.fn(),
  grid: () => ({ cols: 80, rows: 24 }),
  write: vi.fn(),
  reset: vi.fn(),
  setInputEnabled: vi.fn(),
  setScheme: vi.fn(),
  run: vi.fn(),
  hasSelection: () => false,
  mouseTracking: () => false,
  dispose: vi.fn(),
});

function Page() {
  const { pathname } = useLocation();
  return (
    <>
      <output aria-label="path">{pathname}</output>
      <ProjectsPage />
    </>
  );
}

describe("project terminal dock", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = projectTerminalSessions.setHostFactory(fakeHost);
  });
  afterEach(() => {
    projectTerminalSessions.reset();
    useProjectTerminalsUi.getState().reset();
    useTerminalPanelStore.setState({ openProjects: [], placement: "bottom" });
    restore();
    resetFixtureTerminals();
  });

  it("opens the shell in a panel without leaving the project, and can dock it right", async () => {
    renderRoutes([{ path: "/:pageId/*", element: <Page /> }], "/projects/tesseract");
    const sandbox = await screen.findByRole("group", { name: "Sandbox" });
    fireEvent.click(within(sandbox).getByRole("button", { name: "Shell" }));

    const panel = await screen.findByRole("complementary", { name: "Project terminals" });
    await waitFor(() => expect(within(panel).getByRole("tab", { name: "Shell" }).getAttribute("aria-selected")).toBe("true"));
    expect(screen.getByLabelText("path").textContent).toBe("/projects/tesseract");
    expect(screen.getByRole("heading", { level: 1, name: "tesseract" })).toBeTruthy();

    fireEvent.click(within(panel).getByRole("button", { name: "Move panel to the right" }));
    expect(useTerminalPanelStore.getState().placement).toBe("right");
    expect(within(panel).getByRole("tab", { name: "Shell" })).toBeTruthy();

    fireEvent.click(within(panel).getByRole("button", { name: "Hide panel" }));
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "Project terminals" })).toBeNull());
  });
});
