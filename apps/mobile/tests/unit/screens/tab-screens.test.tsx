import { fireEvent, render, screen } from "@testing-library/react-native";
import { PlusIcon, TrashIcon } from "phosphor-react-native";
import {
  sampleAgentRun,
  sampleBuild,
  sampleProcess,
  sampleProject,
  sampleStatusEvent,
  sampleTerminal,
} from "@theone/protocol/fixtures";

import AgentsScreen from "@/app/(tabs)/agents";
import HomeScreen from "@/app/(tabs)/index";
import ProfileScreen from "@/app/(tabs)/profile";
import ProjectsScreen from "@/app/(tabs)/projects";
import TasksScreen from "@/app/(tabs)/tasks";
import { TEST_SANDBOX } from "../sandbox/helpers";

const mockHub = jest.fn();

jest.mock("@/components/glass", () => {
  const { Pressable, View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { GlassSurface: View, GlassPill: View, GlassButton: Pressable };
});
jest.mock("@/features/sandbox/hooks/use-sandbox-hub", () => ({ useSandboxHub: () => mockHub() }));

const nav = {
  pair: jest.fn(),
  project: jest.fn(),
  terminal: jest.fn(),
  build: jest.fn(),
  agentRun: jest.fn(),
  newAgentRun: jest.fn(),
};

function hub(overrides: object = {}) {
  return {
    nav,
    hydrated: true,
    sandbox: TEST_SANDBOX,
    missingToken: false,
    link: "open",
    subtitle: "up 1h · sandbox · v0.1.0",
    issue: null,
    repair: jest.fn(),
    statusError: null,
    retryStatus: jest.fn(),
    stats: [],
    actions: [{ id: "display", label: "Display", icon: PlusIcon, onPress: jest.fn() }],
    switcher: [{ id: TEST_SANDBOX.id, label: TEST_SANDBOX.name }],
    selectSandbox: jest.fn(),
    latestActivity: null,
    projects: [],
    projectsLoading: false,
    addProject: jest.fn(),
    runningProcesses: [],
    stoppingId: null,
    processPress: jest.fn(() => undefined),
    stopProcess: jest.fn(),
    sessions: [],
    closingId: null,
    closeSession: jest.fn(async () => undefined),
    recentBuilds: [],
    recentRuns: [],
    refreshing: false,
    refresh: jest.fn(),
    headerActions: [{ id: "remove", icon: TrashIcon, label: "Remove this sandbox", onPress: jest.fn() }],
    removeError: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockHub.mockReset();
  Object.values(nav).forEach((fn) => fn.mockClear());
});

describe("AgentsScreen", () => {
  it("waits for the stored sandboxes", async () => {
    mockHub.mockReturnValue(hub({ hydrated: false }));
    await render(<AgentsScreen />);
    expect(screen.getByLabelText("Loading sandboxes…")).toBeOnTheScreen();
  });

  it("asks to pair when there is no sandbox", async () => {
    mockHub.mockReturnValue(hub({ sandbox: null }));
    await render(<AgentsScreen />);
    await fireEvent.press(screen.getByLabelText("Pair a sandbox"));
    expect(nav.pair).toHaveBeenCalled();
  });

  it("shows an empty hub with an add-project prompt", async () => {
    const state = hub();
    mockHub.mockReturnValue(state);
    await render(<AgentsScreen />);

    expect(screen.getByText(TEST_SANDBOX.name)).toBeOnTheScreen();
    expect(screen.getByText("Online")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Paired sandboxes")).toBeNull();
    expect(screen.getByText("No builds yet.")).toBeOnTheScreen();
    expect(screen.getByText("No Claude runs yet.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Add a project"));
    expect(state.addProject).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("New run, Claude runs"));
    expect(nav.newAgentRun).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Add, Projects"));
    expect(state.addProject).toHaveBeenCalledTimes(2);
  });

  it("shows every problem notice and wires its actions", async () => {
    const state = hub({
      missingToken: true,
      issue: { title: "Pairing no longer valid", message: "Pair again", actionLabel: "Pair again" },
      statusError: "Can't reach the sandbox.",
      removeError: "Remove failed",
      latestActivity: sampleStatusEvent,
      switcher: [
        { id: TEST_SANDBOX.id, label: TEST_SANDBOX.name },
        { id: "sbx_2", label: "Second" },
      ],
    });
    mockHub.mockReturnValue(state);
    await render(<AgentsScreen />);

    await fireEvent.press(screen.getByLabelText("Pair"));
    expect(nav.pair).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Pair again"));
    expect(state.repair).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(state.retryStatus).toHaveBeenCalled();
    expect(screen.getByText("Remove failed")).toBeOnTheScreen();
    expect(screen.getByText(sampleStatusEvent.message)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Second"));
    expect(state.selectSandbox).toHaveBeenCalledWith("sbx_2");
  });

  it("lists projects, running work, sessions, builds and runs", async () => {
    const state = hub({
      stats: [{ id: "cpu", icon: PlusIcon, label: "CPU load", value: "0.42", unit: "/ 8 cores", progress: 0.05 }],
      projects: [sampleProject],
      runningProcesses: [sampleProcess],
      sessions: [sampleTerminal],
      recentBuilds: [sampleBuild],
      recentRuns: [sampleAgentRun],
    });
    mockHub.mockReturnValue(state);
    await render(<AgentsScreen />);

    expect(screen.getByText("CPU load")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(new RegExp(`^${sampleProject.name}, Electron`)));
    expect(nav.project).toHaveBeenCalledWith(sampleProject.id);
    await fireEvent.press(screen.getByLabelText(`Stop ${sampleProcess.name}`));
    expect(state.stopProcess).toHaveBeenCalledWith(sampleProcess.id);
    expect(state.processPress).toHaveBeenCalledWith(sampleProcess);
    await fireEvent.press(screen.getByLabelText(/^bash/));
    expect(nav.terminal).toHaveBeenCalledWith(sampleTerminal.id);
    await fireEvent.press(screen.getByLabelText("Close session"));
    expect(state.closeSession).toHaveBeenCalledWith(sampleTerminal);
    await fireEvent.press(screen.getByLabelText(/^Windows installer/));
    expect(nav.build).toHaveBeenCalledWith(sampleBuild.id);
    await fireEvent.press(screen.getByLabelText(new RegExp(`^${sampleAgentRun.prompt}`)));
    expect(nav.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);
  });

  it("does not claim there are no projects while they load", async () => {
    mockHub.mockReturnValue(hub({ projectsLoading: true }));
    await render(<AgentsScreen />);
    expect(screen.queryByLabelText("Add a project")).toBeNull();
  });
});

describe("demo tab screens", () => {
  it.each([
    ["Home", HomeScreen, "Recent Forms"],
    ["Projects", ProjectsScreen, "All Projects"],
    ["Profile", ProfileScreen, "Activity"],
    ["Tasks", TasksScreen, "Tasks"],
  ])("renders %s", async (_name, Screen, text) => {
    await render(<Screen />);
    expect(screen.getByText(text)).toBeOnTheScreen();
  });
});
