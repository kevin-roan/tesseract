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
import ProfileScreen from "@/app/(tabs)/profile";
import ProjectsScreen from "@/app/(tabs)/projects";
import TasksScreen from "@/app/(tabs)/tasks";
import { TEST_SANDBOX, TEST_SITE } from "../sandbox/helpers";

const mockHub = jest.fn();
const mockProfile = jest.fn();
const mockProjects = jest.fn();
const mockTasks = jest.fn();

jest.mock("@/features/sandbox/hooks/use-sandbox-hub", () => ({ useSandboxHub: () => mockHub() }));
jest.mock("@/features/sandbox/hooks/use-profile-screen", () => ({ useProfileScreen: () => mockProfile() }));
jest.mock("@/features/sandbox/hooks/use-projects-screen", () => ({ useProjectsScreen: () => mockProjects() }));
jest.mock("@/features/sandbox/hooks/use-tasks-screen", () => ({ useTasksScreen: () => mockTasks() }));
jest.mock("@/hooks/use-status-bar-style", () => ({ useStatusBarStyle: jest.fn() }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

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
    buildsLoading: false,
    recentRuns: [],
    runsLoading: false,
    actionError: null,
    refreshing: false,
    refresh: jest.fn(),
    headerActions: [{ id: "remove", icon: TrashIcon, label: "Remove this sandbox", onPress: jest.fn() }],
    removeError: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockHub.mockReset();
  mockProfile.mockReset();
  mockProjects.mockReset();
  mockTasks.mockReset();
  Object.values(nav).forEach((fn) => fn.mockClear());
});

describe("AgentsScreen", () => {
  it("shows the loading gate without a sandbox", async () => {
    mockHub.mockReturnValue(hub({ sandbox: null }));
    await render(<AgentsScreen />);
    expect(screen.getByLabelText("Loading sandboxes…")).toBeOnTheScreen();
    expect(screen.queryByText("Pair a sandbox")).toBeNull();
  });

  it("shows an empty hub with an add-project prompt", async () => {
    const state = hub();
    mockHub.mockReturnValue(state);
    await render(<AgentsScreen />);

    expect(screen.getByText(TEST_SANDBOX.name)).toBeOnTheScreen();
    expect(screen.getByText("Online")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Paired sandboxes")).toBeNull();
    expect(screen.getByText(/^No builds yet/)).toBeOnTheScreen();
    expect(screen.getByText("No Claude runs yet.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Ask Claude"));
    expect(nav.newAgentRun).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Add a project"));
    expect(state.addProject).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("New run, Claude runs"));
    expect(nav.newAgentRun).toHaveBeenCalledTimes(2);
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

  it("does not claim there are no projects, builds or runs while they load", async () => {
    mockHub.mockReturnValue(hub({ projectsLoading: true, buildsLoading: true, runsLoading: true }));
    await render(<AgentsScreen />);
    expect(screen.queryByLabelText("Add a project")).toBeNull();
    expect(screen.queryByText(/^No builds yet/)).toBeNull();
    expect(screen.queryByText("No Claude runs yet.")).toBeNull();
  });

  it("shows a failed stop or close", async () => {
    mockHub.mockReturnValue(hub({ actionError: "Process is not running" }));
    await render(<AgentsScreen />);
    expect(screen.getByText("Process is not running")).toBeOnTheScreen();
  });
});

describe("ProfileScreen", () => {
  const activityItem = {
    id: "build-bld_1",
    actor: "Ada Lovelace",
    action: "built Windows installer for",
    target: "electron-hello",
    timeAgo: "5m ago",
    metrics: [{ id: "state", value: "Succeeded", label: "State" }],
    testID: "activity-build-bld_1",
    onPress: jest.fn(),
  };

  function profile(overrides: object = {}) {
    return {
      nav,
      hydrated: true,
      sandbox: TEST_SANDBOX,
      profile: { name: "Ada Lovelace", tagline: "ada@example.com · sandbox.tail1234.ts.net", team: "example.com" },
      stats: [
        { id: "projects", value: "2", label: "Projects" },
        { id: "running", value: "1", label: "Running" },
        { id: "builds", value: "1", label: "Builds" },
      ],
      openHub: jest.fn(),
      tailscaleMissing: false,
      identityError: null,
      retryIdentity: jest.fn(),
      missingToken: false,
      issue: null,
      repair: jest.fn(),
      statusError: null,
      retryStatus: jest.fn(),
      claudeAccount: "dev@example.com",
      openClaudeAccount: jest.fn(),
      activity: [],
      activityLoading: false,
      activityError: null,
      retryActivity: jest.fn(),
      refreshing: false,
      refresh: jest.fn(),
      ...overrides,
    };
  }

  it("shows the loading gate until the sandbox and profile are there", async () => {
    mockProfile.mockReturnValue(profile({ sandbox: null, profile: null }));
    await render(<ProfileScreen />);
    expect(screen.getByLabelText("Loading sandboxes…")).toBeOnTheScreen();

    mockProfile.mockReturnValue(profile({ profile: null }));
    await render(<ProfileScreen />);
    expect(screen.getByLabelText("Loading sandboxes…")).toBeOnTheScreen();
  });

  it("shows the Tailscale identity, stats and activity", async () => {
    const state = profile({ activity: [activityItem] });
    mockProfile.mockReturnValue(state);
    await render(<ProfileScreen />);

    expect(screen.getByTestId("profile-name")).toHaveTextContent("Ada Lovelace");
    expect(screen.getByTestId("profile-tailnet")).toHaveTextContent("example.com");
    expect(screen.getByText("ada@example.com · sandbox.tail1234.ts.net")).toBeOnTheScreen();
    expect(screen.getByText("Running")).toBeOnTheScreen();
    expect(screen.getByTestId("profile-activity")).toBeOnTheScreen();
    expect(screen.queryByText("Tailscale identity not exposed")).toBeNull();
    await fireEvent.press(screen.getByTestId("activity-build-bld_1"));
    expect(activityItem.onPress).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Open the sandbox hub"));
    expect(state.openHub).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Claude account, dev@example.com"));
    expect(state.openClaudeAccount).toHaveBeenCalled();
  });

  it("explains a missing Tailscale identity, problems and an empty feed", async () => {
    const state = profile({
      profile: { name: TEST_SANDBOX.name, tagline: TEST_SANDBOX.baseUrl },
      tailscaleMissing: true,
      identityError: "Can't reach the sandbox.",
      missingToken: true,
      issue: { title: "Pairing no longer valid", message: "Pair again", actionLabel: "Pair again" },
      statusError: "Status failed",
    });
    mockProfile.mockReturnValue(state);
    await render(<ProfileScreen />);

    expect(screen.getByTestId("profile-name")).toHaveTextContent(TEST_SANDBOX.name);
    expect(screen.queryByTestId("profile-tailnet")).toBeNull();
    expect(screen.getByText("Tailscale identity not exposed")).toBeOnTheScreen();
    expect(screen.getByText("No activity yet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Pair"));
    expect(nav.pair).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Pair again"));
    expect(state.repair).toHaveBeenCalled();
    const retries = screen.getAllByLabelText("Retry");
    for (const retry of retries) await fireEvent.press(retry);
    expect(state.retryStatus).toHaveBeenCalled();
    expect(state.retryIdentity).toHaveBeenCalled();
  });

  it("shows a failed activity feed with a retry instead of an empty feed", async () => {
    const state = profile({ activityError: "Can't reach the sandbox." });
    mockProfile.mockReturnValue(state);
    await render(<ProfileScreen />);

    expect(screen.queryByText("No activity yet")).toBeNull();
    expect(screen.getByText("Can't reach the sandbox.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(state.retryActivity).toHaveBeenCalled();
  });

  it("offers a first Claude run on an empty feed", async () => {
    mockProfile.mockReturnValue(profile());
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Ask Claude"));
    expect(nav.newAgentRun).toHaveBeenCalled();
  });

  it("shows a spinner while the activity loads", async () => {
    mockProfile.mockReturnValue(profile({ activityLoading: true }));
    await render(<ProfileScreen />);
    expect(screen.getByLabelText("Loading activity…")).toBeOnTheScreen();
  });
});

describe("ProjectsScreen", () => {
  const card = {
    id: "electron-hello",
    title: "electron-hello",
    subtitle: "3f2a9c1 · Initial commit · 1h ago",
    status: { caption: "Status", value: "Running", tone: "success" },
    tag: { caption: "Framework", value: "Electron", tone: "info" },
    detail: { caption: "Branch", value: "main" },
    members: [{ id: sampleProcess.id, name: sampleProcess.name }],
    membersTitle: "1 active task",
    membersCaption: "in this project",
  };

  function projects(overrides: object = {}) {
    return {
      nav,
      hydrated: true,
      sandbox: TEST_SANDBOX,
      link: "open",
      headerActions: [{ id: "new-project", icon: PlusIcon, label: "New project", onPress: jest.fn() }],
      missingToken: false,
      issue: null,
      repair: jest.fn(),
      projectsError: null,
      retryProjects: jest.fn(),
      projects: [],
      projectsLoading: false,
      addProject: jest.fn(),
      openProject: jest.fn(),
      askClaude: jest.fn(),
      running: { processes: [], builds: [], runs: [] },
      runningCount: 0,
      processPress: jest.fn(() => undefined),
      sites: [],
      sitePress: jest.fn(() => undefined),
      openSite: jest.fn(),
      siteError: null,
      stopProcess: jest.fn(),
      stoppingId: null,
      stopError: null,
      refreshing: false,
      refresh: jest.fn(),
      ...overrides,
    };
  }

  it("shows the loading gate without a sandbox", async () => {
    mockProjects.mockReturnValue(projects({ sandbox: null }));
    await render(<ProjectsScreen />);
    expect(screen.getByLabelText("Loading sandboxes…")).toBeOnTheScreen();
  });

  it("offers to add a project when there are none", async () => {
    const state = projects();
    mockProjects.mockReturnValue(state);
    await render(<ProjectsScreen />);

    expect(screen.getByText("Projects")).toBeOnTheScreen();
    expect(screen.getByText(TEST_SANDBOX.name)).toBeOnTheScreen();
    expect(screen.queryByTestId("running-section")).toBeNull();
    expect(screen.queryByTestId("sites-section")).toBeNull();
    expect(screen.getByLabelText("New project")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Add a project"));
    await fireEvent.press(screen.getByLabelText("Add, All projects"));
    expect(state.addProject).toHaveBeenCalledTimes(2);
  });

  it("lists running work and project cards", async () => {
    const state = projects({
      projects: [card],
      running: { processes: [sampleProcess], builds: [{ ...sampleBuild, state: "running" }], runs: [sampleAgentRun] },
      runningCount: 3,
    });
    mockProjects.mockReturnValue(state);
    await render(<ProjectsScreen />);

    expect(screen.getByTestId("running-section")).toBeOnTheScreen();
    expect(screen.getByTestId("projects-list")).toBeOnTheScreen();
    expect(screen.getByText("1 active task")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`project-card-${card.id}`));
    expect(state.openProject).toHaveBeenCalledWith(card.id);
    expect(screen.queryByLabelText(`More options for ${card.title}`)).toBeNull();
    await fireEvent.press(screen.getByLabelText(`Ask Claude about ${card.title}`));
    expect(state.askClaude).toHaveBeenCalledWith(card.id);
    await fireEvent.press(screen.getByLabelText(`Stop ${sampleProcess.name}`));
    expect(state.stopProcess).toHaveBeenCalledWith(sampleProcess.id);
    await fireEvent.press(screen.getByLabelText(/^Windows installer/));
    expect(nav.build).toHaveBeenCalledWith(sampleBuild.id);
    await fireEvent.press(screen.getByLabelText(new RegExp(`^${sampleAgentRun.prompt}`)));
    expect(nav.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);
  });

  it("lists running websites with their Tailscale links", async () => {
    const openProject = jest.fn();
    const state = projects({
      sites: [TEST_SITE, { ...TEST_SITE, port: 8080, projectId: null, processId: null, url: null, dnsUrl: null }],
      sitePress: jest.fn((site: typeof TEST_SITE) => (site.projectId ? openProject : undefined)),
      siteError: "Can't open that link",
    });
    mockProjects.mockReturnValue(state);
    await render(<ProjectsScreen />);

    expect(screen.getByTestId("sites-section")).toBeOnTheScreen();
    expect(screen.getByText(TEST_SITE.url!)).toBeOnTheScreen();
    expect(screen.getByText(/No Tailscale IP yet/)).toBeOnTheScreen();
    expect(screen.getByText("Can't open that link")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Open :5173 in browser"));
    expect(state.openSite).toHaveBeenCalledWith(TEST_SITE.url);
    expect(screen.queryByLabelText("Open :8080 in browser")).toBeNull();
    await fireEvent.press(screen.getByLabelText(":5173, node vite"));
    expect(openProject).toHaveBeenCalled();
  });

  it("shows problems and does not claim there are no projects while they load", async () => {
    const state = projects({
      projectsLoading: true,
      missingToken: true,
      issue: { title: "Version mismatch", message: "Update", actionLabel: "Pair again" },
      projectsError: "Can't reach the sandbox.",
    });
    mockProjects.mockReturnValue(state);
    await render(<ProjectsScreen />);

    expect(screen.queryByLabelText("Add a project, All projects")).toBeNull();
    expect(screen.queryByText(/No projects in/)).toBeNull();
    expect(screen.getByLabelText("Loading projects…")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Pair"));
    await fireEvent.press(screen.getByLabelText("Pair again"));
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(nav.pair).toHaveBeenCalled();
    expect(state.repair).toHaveBeenCalled();
    expect(state.retryProjects).toHaveBeenCalled();
  });
});

describe("TasksScreen", () => {
  const none = { processes: [], builds: [], runs: [] };

  function tasks(overrides: object = {}) {
    return {
      nav,
      hydrated: true,
      sandbox: TEST_SANDBOX,
      link: "open",
      headerActions: [{ id: "ask-claude", icon: PlusIcon, label: "Ask Claude", onPress: jest.fn() }],
      missingToken: false,
      issue: null,
      repair: jest.fn(),
      error: null,
      retry: jest.fn(),
      loading: false,
      running: none,
      runningCount: 0,
      finished: none,
      finishedCount: 0,
      processPress: jest.fn(() => undefined),
      stopProcess: jest.fn(),
      stoppingId: null,
      stopError: null,
      refreshing: false,
      refresh: jest.fn(),
      ...overrides,
    };
  }

  it("shows the loading gate without a sandbox", async () => {
    mockTasks.mockReturnValue(tasks({ sandbox: null }));
    await render(<TasksScreen />);
    expect(screen.getByLabelText("Loading sandboxes…")).toBeOnTheScreen();
  });

  it("shows a spinner instead of empty sections while the lists load", async () => {
    mockTasks.mockReturnValue(tasks({ loading: true }));
    await render(<TasksScreen />);
    expect(screen.getByLabelText("Loading tasks…")).toBeOnTheScreen();
    expect(screen.queryByTestId("tasks-running")).toBeNull();
  });

  it("invites a first job when nothing ran yet", async () => {
    mockTasks.mockReturnValue(tasks());
    await render(<TasksScreen />);
    expect(screen.getByText("Tasks")).toBeOnTheScreen();
    expect(screen.getByText(/^Nothing is running/)).toBeOnTheScreen();
    expect(screen.getByText(/^Finished processes/)).toBeOnTheScreen();
    const [, emptyAction] = screen.getAllByLabelText("Ask Claude");
    await fireEvent.press(emptyAction);
    expect(nav.newAgentRun).toHaveBeenCalled();
  });

  it("lists running and finished work from the sandbox", async () => {
    const finishedBuild = { ...sampleBuild, id: "bld_done" };
    const state = tasks({
      running: { processes: [sampleProcess], builds: [{ ...sampleBuild, state: "running" }], runs: [sampleAgentRun] },
      runningCount: 3,
      finished: { processes: [{ ...sampleProcess, id: "prc_done", state: "exited" }], builds: [finishedBuild], runs: [] },
      finishedCount: 2,
      stopError: "Process is not running",
    });
    mockTasks.mockReturnValue(state);
    await render(<TasksScreen />);

    expect(screen.getByText("Process is not running")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(`Stop ${sampleProcess.name}`));
    expect(state.stopProcess).toHaveBeenCalledWith(sampleProcess.id);
    expect(screen.getAllByLabelText(`Stop ${sampleProcess.name}`)).toHaveLength(1);
    await fireEvent.press(screen.getAllByLabelText(/^Windows installer/)[1]);
    expect(nav.build).toHaveBeenCalledWith(finishedBuild.id);
    await fireEvent.press(screen.getByLabelText(new RegExp(`^${sampleAgentRun.prompt}`)));
    expect(nav.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);
  });

  it("shows list errors with a retry", async () => {
    const state = tasks({ error: "Can't reach the sandbox." });
    mockTasks.mockReturnValue(state);
    await render(<TasksScreen />);
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(state.retry).toHaveBeenCalled();
  });
});
