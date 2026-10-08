import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { renderRoutes } from "../../test/render";
import ProjectsPage from "./ProjectsPage";

MotionGlobalConfig.skipAnimations = true;

const routes = [{ path: "/:pageId/*", element: <ProjectsPage /> }];

describe("ProjectsPage", () => {
  it("lists the fixture projects with tab counts", async () => {
    renderRoutes(routes, "/projects");
    expect(await screen.findByRole("button", { name: "streaxfit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "tesseract" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "hybrid-pos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "sante-production" })).toBeTruthy();
    const tabs = screen.getByRole("tablist", { name: "Project filter" });
    expect(within(tabs).getByRole("tab", { name: /All projects/ }).getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(within(tabs).getByRole("tab", { name: /Active/ }).textContent).toContain("1"));
    expect(screen.getByText("1 running")).toBeTruthy();
  });

  it("filters with the search field and shows the no-match state", async () => {
    renderRoutes(routes, "/projects");
    await screen.findByRole("button", { name: "streaxfit" });
    fireEvent.click(screen.getByRole("button", { name: "Search projects" }));
    const field = await screen.findByRole("searchbox");
    fireEvent.change(field, { target: { value: "zzz" } });
    expect(await screen.findByText("No matching projects")).toBeTruthy();
    expect(screen.getByText("Nothing matches “zzz”.")).toBeTruthy();
    const clear = screen.getAllByRole("button", { name: "Clear search" }).find((button) => button.textContent === "Clear search");
    fireEvent.click(clear!);
    expect(await screen.findByRole("button", { name: "streaxfit" })).toBeTruthy();
  });

  it("closes and clears the search with one Escape", async () => {
    renderRoutes(routes, "/projects");
    await screen.findByRole("button", { name: "streaxfit" });
    fireEvent.keyDown(document.body, { key: "f", ctrlKey: true });
    const field = await screen.findByRole("searchbox");
    fireEvent.change(field, { target: { value: "zzz" } });
    expect(await screen.findByText("No matching projects")).toBeTruthy();
    fireEvent.keyDown(field, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("searchbox")).toBeNull());
    expect(await screen.findByRole("button", { name: "streaxfit" })).toBeTruthy();
  });

  it("ignores the search shortcut while a dialog is open", async () => {
    renderRoutes(routes, "/projects?dialog=create");
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    fireEvent.keyDown(name, { key: "f", ctrlKey: true });
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("renders the project detail header and tabs", async () => {
    renderRoutes(routes, "/projects/tesseract");
    expect(await screen.findByRole("heading", { level: 1, name: "tesseract" })).toBeTruthy();
    expect(screen.getByText("/workspace/projects/tesseract")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask Claude" })).toBeTruthy();
    const sections = screen.getByRole("tablist", { name: "Project sections" });
    expect(within(sections).getAllByRole("tab").map((tab) => tab.textContent?.replace(/\d+/g, ""))).toEqual([
      "Processes",
      "Builds",
      "Artifacts",
      "Git",
      "Sync back",
      "Chats",
    ]);
    expect(await screen.findByText("Node · bun")).toBeTruthy();
  });

  it("shows the error state for a missing project", async () => {
    renderRoutes(routes, "/projects/tesseract-test-missing");
    expect(await screen.findByText("Couldn't load this project")).toBeTruthy();
    expect(screen.getByText("Project tesseract-test-missing not found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("validates the create dialog", async () => {
    renderRoutes(routes, "/projects?dialog=create");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Becomes a folder in /workspace/projects.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(await within(dialog).findByText("Enter a project name.")).toBeTruthy();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), { target: { value: "My App" } });
    expect(within(dialog).getByText("Created as /workspace/projects/my-app")).toBeTruthy();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Git URL (optional)" }), { target: { value: "https://x/y.git" } });
    expect(within(dialog).getByRole("button", { name: "Clone" })).toBeTruthy();
  });

  it("swaps the name for a pseudonym when confidential", async () => {
    renderRoutes(routes, "/projects?dialog=create");
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Secret Client" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confidential" }));
    await waitFor(() => expect(name.value).toMatch(/^[a-z]+-[a-z]+$/));
    expect(name.readOnly).toBe(true);
    expect(within(dialog).getByRole("button", { name: "New pseudonym" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confidential" }));
    await waitFor(() => expect(name.value).toBe("Secret Client"));
  });
});
