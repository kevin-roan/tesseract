import { fireEvent, render, screen } from "@testing-library/react-native";
import type { LogLine } from "@theone/protocol";
import { FolderPlusIcon, HammerIcon, MonitorIcon } from "phosphor-react-native";

import ActionTile from "@/components/action-tile";
import ActionTileRow from "@/components/action-tile-row";
import Section from "@/components/section";
import NewProjectView from "@/features/sandbox/components/new-project-view";
import type { useNewProject } from "@/features/sandbox/hooks/use-new-project";
import { EMPTY_PROJECT_DRAFT } from "@/features/sandbox/utils/new-project";

type NewProject = ReturnType<typeof useNewProject>;

const mockUseNewProject = jest.fn<NewProject, []>();

jest.mock("@/features/sandbox/hooks/use-new-project", () => ({ useNewProject: () => mockUseNewProject() }));

const nav = { back: jest.fn() } as unknown as NewProject["nav"];

function formState(overrides: Partial<NewProject["form"]> = {}): NewProject {
  return {
    nav,
    form: {
      draft: EMPTY_PROJECT_DRAFT,
      errors: {},
      setField: jest.fn(),
      submit: jest.fn(),
      submitting: false,
      submitLabel: "Create project",
      locationHint: "Becomes a folder in /workspace/projects.",
      error: null,
      ...overrides,
    },
    clone: null,
  };
}

describe("<ActionTile />", () => {
  it("announces why a disabled tile does nothing and ignores presses", async () => {
    const onPress = jest.fn();
    await render(
      <ActionTile icon={HammerIcon} label="Build" onPress={onPress} disabled accessibilityHint="No build targets yet." />,
    );

    const tile = screen.getByRole("button", { name: "Build" });
    expect(tile).toBeDisabled();
    expect(tile.props.accessibilityHint).toBe("No build targets yet.");
    await fireEvent.press(tile);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("works like a normal tile when enabled", async () => {
    const onPress = jest.fn();
    await render(
      <ActionTileRow
        items={[
          { id: "display", icon: MonitorIcon, label: "Display", onPress, tone: "yellow", accessibilityHint: "Opens the desktop." },
          { id: "build", icon: HammerIcon, label: "Build", disabled: true },
        ]}
      />,
    );

    const display = screen.getByRole("button", { name: "Display" });
    expect(display).toBeEnabled();
    await fireEvent.press(display);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Build" })).toBeDisabled();
  });
});

describe("<Section /> empty action", () => {
  it("offers the call to action only while the section is empty", async () => {
    const onAdd = jest.fn();
    const { rerender } = await render(
      <Section
        title="Projects"
        actionLabel="Add"
        onPressAction={onAdd}
        isEmpty
        emptyLabel="No projects yet."
        emptyActionLabel="Add a project"
        emptyActionIcon={FolderPlusIcon}
        onEmptyAction={onAdd}
      />,
    );

    expect(screen.getByText("No projects yet.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Add a project" }));
    await fireEvent.press(screen.getByRole("button", { name: "Add, Projects" }));
    expect(onAdd).toHaveBeenCalledTimes(2);

    await rerender(
      <Section title="Projects" isEmpty={false} emptyLabel="No projects yet." emptyActionLabel="Add a project" onEmptyAction={onAdd} />,
    );
    expect(screen.queryByRole("button", { name: "Add a project" })).toBeNull();
  });
});

describe("<NewProjectView />", () => {
  it("renders the form and submits it", async () => {
    const state = formState({
      draft: { name: "notes", gitUrl: "https://x.dev/r.git", branch: "" },
      submitLabel: "Clone project",
      locationHint: "Created as /workspace/projects/notes",
      errors: { branch: "That is not a valid branch name." },
      error: "Project notes already exists",
    });
    mockUseNewProject.mockReturnValue(state);
    await render(<NewProjectView />);

    expect(screen.getByText("New project")).toBeOnTheScreen();
    expect(screen.getByText("Created as /workspace/projects/notes")).toBeOnTheScreen();
    expect(screen.getByText("That is not a valid branch name.")).toBeOnTheScreen();
    expect(screen.getByText("Project notes already exists")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText("Git URL (optional)"), "git@x.dev:me/r.git");
    expect(state.form.setField).toHaveBeenCalledWith("gitUrl", "git@x.dev:me/r.git");
    await fireEvent.press(screen.getByRole("button", { name: "Clone project" }));
    expect(state.form.submit).toHaveBeenCalledTimes(1);
  });

  it("shows the live clone log, then the failure with a way into the project", async () => {
    const line: LogLine = { seq: 1, ts: "2026-09-23T10:00:00.000Z", stream: "stderr", text: "fatal: repository not found" };
    const openProject = jest.fn();
    mockUseNewProject.mockReturnValue({
      ...formState(),
      clone: {
        projectId: "notes",
        processId: "prc_clone00001",
        gitUrl: "https://x.dev/r.git",
        lines: [line],
        exitCode: 128,
        badge: { label: "Failed", tone: "danger" },
        failure: "git exited with code 128.",
        emptyLabel: "Waiting for git…",
        openProject,
      },
    });
    await render(<NewProjectView />);

    expect(screen.getByText("notes")).toBeOnTheScreen();
    expect(screen.getByText("Failed")).toBeOnTheScreen();
    expect(screen.getByText("fatal: repository not found")).toBeOnTheScreen();
    expect(screen.queryByText("New project")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Open project" }));
    expect(openProject).toHaveBeenCalledTimes(1);
  });
});
