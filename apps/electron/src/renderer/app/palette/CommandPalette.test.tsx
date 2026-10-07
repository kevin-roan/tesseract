import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router";
import { skipMotionInTests } from "../../components/DialogShell/skip-motion";
import { renderRoutes } from "../../test/render";
import { resetConnectionRuntime } from "../connection";
import { CommandPalette } from "./CommandPalette";
import { registerPaletteCommands } from "./registry";
import { openCommandPalette, usePaletteStore } from "./store";

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

const routes = [
  {
    path: "/:pageId/*",
    element: (
      <>
        <LocationProbe />
        <CommandPalette />
      </>
    ),
  },
];

const input = () => screen.getByRole("combobox");

describe("CommandPalette", () => {
  beforeAll(() => {
    skipMotionInTests();
  });
  beforeEach(() => usePaletteStore.setState({ open: false, query: "", recent: [] }));
  afterEach(() => resetConnectionRuntime());

  it("opens with the page context and focuses the search input", async () => {
    renderRoutes(routes, "/overview");
    act(() => openCommandPalette());
    expect(await screen.findByRole("dialog", { name: "Command menu" })).toBeTruthy();
    expect(screen.getByTestId("dialog-context").textContent).toContain("Overview");
    expect(document.activeElement).toBe(input());
    expect(screen.getByRole("option", { name: /Go to Agents/ })).toBeTruthy();
  });

  it("filters, navigates with the keyboard and runs the selected command", async () => {
    renderRoutes(routes, "/overview");
    act(() => openCommandPalette());
    fireEvent.change(await screen.findByRole("combobox"), { target: { value: "go to" } });
    const options = screen.getAllByRole("option");
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]?.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/agents"));
    expect(usePaletteStore.getState().open).toBe(false);
    expect(usePaletteStore.getState().recent).toEqual(["page:agents"]);
  });

  it("opens the settings route from a settings command", async () => {
    renderRoutes(routes, "/overview");
    act(() => openCommandPalette("appearance settings"));
    fireEvent.keyDown(await screen.findByRole("combobox"), { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/overview?preferences=appearance"));
  });

  it("shows an empty state and closes on Escape", async () => {
    renderRoutes(routes, "/overview");
    act(() => openCommandPalette("qqqqzzzz"));
    expect(await screen.findByText("No results for “qqqqzzzz”")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("includes commands registered by other parts of the app", async () => {
    const run = vi.fn();
    const unregister = registerPaletteCommands("test", [{ id: "test:archive", title: "Archive conversation", group: "Conversation", run }]);
    renderRoutes(routes, "/agents");
    act(() => openCommandPalette("archive"));
    fireEvent.click(await screen.findByRole("option", { name: /Archive conversation/ }));
    expect(run).toHaveBeenCalledTimes(1);
    unregister();
  });

  it("opens from the route flag used by snapshots", async () => {
    renderRoutes(routes, "/overview?palette=zoom");
    expect(await screen.findByRole("option", { name: /Zoom in/ })).toBeTruthy();
    expect((input() as HTMLInputElement).value).toBe("zoom");
  });
});
