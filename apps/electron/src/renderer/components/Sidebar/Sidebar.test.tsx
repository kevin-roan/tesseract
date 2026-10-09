import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarContainers } from "./SidebarContainers";
import { SidebarNav, SidebarNavRow } from "./SidebarNav";
import { SidebarProjectRow } from "./SidebarProjectRow";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarSection } from "./SidebarSection";

const LABELS = { loading: "Loading projects…", offline: "Offline", empty: "No projects yet.", createProject: "Create a project" };

describe("SidebarSection", () => {
  it("folds and unfolds its content", async () => {
    const onOpenChange = vi.fn();
    render(
      <SidebarSection title="Sandbox" onOpenChange={onOpenChange}>
        <span>Overview</span>
      </SidebarSection>,
    );
    const toggle = screen.getByRole("button", { name: /Sandbox/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByText("Overview")).toBeNull());
  });
});

describe("SidebarNavRow", () => {
  it("marks the selected row and hides empty counts", () => {
    render(
      <SidebarNav>
        <SidebarNavRow label="Overview" icon="overview" selected count={0} />
        <SidebarNavRow label="Agents" icon="agents" count={120} href="#/agents" />
      </SidebarNav>,
    );
    expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
    const agents = screen.getByRole("link", { name: /Agents/ });
    expect(agents.getAttribute("href")).toBe("#/agents");
    expect(agents.textContent).toContain("99+");
  });
});

describe("SidebarProjectRow", () => {
  it("labels real projects and the No project row", () => {
    const onOpen = vi.fn();
    const onNew = vi.fn();
    const { rerender } = render(<SidebarProjectRow name="tesseract" tint={1} running={2} onOpen={onOpen} onNew={onNew} onToggle={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Open tesseract" }));
    fireEvent.click(screen.getByRole("button", { name: "New conversation in tesseract" }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onNew).toHaveBeenCalledOnce();
    expect(screen.getByTitle("2 running").textContent).toContain("2");
    expect(screen.getByRole("button", { name: "Show conversations" })).toBeTruthy();
    const onToggle = vi.fn();
    rerender(<SidebarProjectRow name="No project" unassigned expanded onToggle={onToggle} />);
    const main = screen.getByRole("button", { name: "No project" });
    expect(main.getAttribute("title")).toBeNull();
    fireEvent.click(main);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Hide conversations" })).toBeTruthy();
  });
});

describe("SidebarProjects", () => {
  it("renders the status states", () => {
    const onCreate = vi.fn();
    const { rerender } = render(<SidebarProjects state="loading" items={[]} labels={LABELS} />);
    expect(screen.getByText("Loading projects…")).toBeTruthy();
    rerender(<SidebarProjects state="empty" items={[]} labels={LABELS} onCreateProject={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "Create a project" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("expands active projects and toggles run lists", async () => {
    const onOpenRun = vi.fn();
    render(
      <SidebarProjects
        state="ready"
        labels={LABELS}
        onOpenRun={onOpenRun}
        items={[
          { id: "tesseract", name: "tesseract", tint: 1, running: 1, runs: [{ id: "r1", title: "Port the sidebar", tone: "info", running: true }] },
          { id: "idle", name: "idle", tint: 2, running: 0, runs: [] },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Port the sidebar" }));
    expect(onOpenRun).toHaveBeenCalledWith("r1");
    expect(screen.queryByText("No conversations yet")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Show conversations" })[0]!);
    expect(screen.getByText("No conversations yet")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Hide conversations" })[0]!);
    await waitFor(() => expect(screen.queryByText("Port the sidebar")).toBeNull());
  });
});

const CONTAINER_LABELS = {
  loading: "Loading containers…",
  unavailable: "Containers need Docker.",
  setUp: "Set up containers",
  empty: "No containers yet.",
  create: "Create a container",
};

describe("SidebarContainers", () => {
  it("opens, starts and stops containers", () => {
    const onOpen = vi.fn();
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(
      <SidebarContainers
        state="ready"
        selected="viglis-prod"
        labels={CONTAINER_LABELS}
        items={[
          { name: "viglis-prod", activity: "running", status: "Running" },
          { name: "staging-db", activity: "stopped", status: "Stopped" },
          { name: "scratch", activity: "busy", status: "Starting" },
        ]}
        onOpen={onOpen}
        onStart={onStart}
        onStop={onStop}
      />,
    );
    const open = screen.getByRole("button", { name: "Open viglis-prod" });
    expect(open.getAttribute("aria-current")).toBe("page");
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledWith("viglis-prod");
    fireEvent.click(screen.getByRole("button", { name: "Stop viglis-prod" }));
    expect(onStop).toHaveBeenCalledWith("viglis-prod");
    fireEvent.click(screen.getByRole("button", { name: "Start staging-db" }));
    expect(onStart).toHaveBeenCalledWith("staging-db");
    expect(screen.queryByRole("button", { name: /(Start|Stop) scratch/ })).toBeNull();
    expect(screen.getByRole("status", { name: "Starting" })).toBeTruthy();
  });

  it("renders the status states", () => {
    const onCreate = vi.fn();
    const onSetUp = vi.fn();
    const { rerender } = render(<SidebarContainers state="unavailable" items={[]} labels={CONTAINER_LABELS} onSetUp={onSetUp} />);
    fireEvent.click(screen.getByRole("button", { name: "Set up containers" }));
    expect(onSetUp).toHaveBeenCalledOnce();
    rerender(<SidebarContainers state="empty" items={[]} labels={CONTAINER_LABELS} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "Create a container" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});
