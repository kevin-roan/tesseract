import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PlusIcon } from "phosphor-react-native";
import {
  sampleAgentRun,
  sampleAgentRunEvents,
  sampleArtifact,
  sampleBuild,
  sampleGitDetails,
  sampleProcess,
  sampleProject,
} from "@theone/protocol/fixtures";

import PairScreen from "@/app/pair";
import AgentRunScreen from "@/app/sandbox/agent/[id]";
import BuildScreen from "@/app/sandbox/builds/[id]";
import DisplayScreen from "@/app/sandbox/display";
import ProjectScreen from "@/app/sandbox/projects/[id]";
import NewProjectScreen from "@/app/sandbox/projects/new";
import TerminalScreen from "@/app/sandbox/terminal/[id]";
import { EMPTY_PAIRING_DRAFT } from "@/features/sandbox/utils/pairing";
import { buildTargetOptions } from "@/features/sandbox/utils/labels";

const mockNav = {
  back: jest.fn(),
  hub: jest.fn(),
  build: jest.fn(),
  replaceWithTerminal: jest.fn(),
};
let mockParams: Record<string, string | string[] | undefined> = {};
const mockHooks: Record<string, jest.Mock> = {
  pair: jest.fn(),
  agentRun: jest.fn(),
  newAgentRun: jest.fn(),
  build: jest.fn(),
  display: jest.fn(),
  project: jest.fn(),
  newProject: jest.fn(),
  launcher: jest.fn(),
  terminal: jest.fn(),
};

jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams }));
jest.mock("@/components/glass", () => {
  const { Pressable, View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { GlassSurface: View, GlassPill: View, GlassButton: Pressable };
});
jest.mock("@/features/sandbox/hooks/use-sandbox-navigation", () => ({ useSandboxNavigation: () => mockNav }));
jest.mock("@/features/sandbox/hooks/use-pair-screen", () => ({ usePairScreen: () => mockHooks.pair() }));
jest.mock("@/features/sandbox/hooks/use-agent-run-screen", () => ({
  useAgentRunScreen: (id: string) => mockHooks.agentRun(id),
}));
jest.mock("@/features/sandbox/hooks/use-new-agent-run", () => ({
  useNewAgentRun: (projectId: string | null) => mockHooks.newAgentRun(projectId),
}));
jest.mock("@/features/sandbox/hooks/use-build-detail", () => ({ useBuildDetail: (id: string) => mockHooks.build(id) }));
jest.mock("@/features/sandbox/hooks/use-display-session", () => ({ useDisplaySession: () => mockHooks.display() }));
jest.mock("@/features/sandbox/hooks/use-project-detail", () => ({
  useProjectDetail: (id: string, processId: string | null) => mockHooks.project(id, processId),
}));
jest.mock("@/features/sandbox/hooks/use-new-project", () => ({ useNewProject: () => mockHooks.newProject() }));
jest.mock("@/features/sandbox/hooks/use-terminal-launcher", () => ({
  useTerminalLauncher: (launch: unknown, onCreated: unknown) => mockHooks.launcher(launch, onCreated),
}));
jest.mock("@/features/sandbox/hooks/use-terminal-session", () => ({
  useTerminalSession: (id: string) => mockHooks.terminal(id),
}));

const headerAction = (label: string, onPress = jest.fn()) => ({ id: label, icon: PlusIcon, label, onPress });

function session(overrides: object = {}) {
  return {
    url: "http://127.0.0.1:7700/ui/page#ticket=t",
    origin: "http://127.0.0.1:7700",
    error: null,
    isLoading: false,
    connection: "connected",
    surfaceRef: createRef(),
    handleMessage: jest.fn(),
    handleLoad: jest.fn(),
    handleError: jest.fn(),
    reconnect: jest.fn(),
    ...overrides,
  };
}

function composer(overrides: object = {}) {
  return {
    prompt: "",
    setPrompt: jest.fn(),
    projectId: null,
    toggleProject: jest.fn(),
    canSubmit: true,
    submit: jest.fn(),
    isSubmitting: false,
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockParams = {};
  Object.values(mockNav).forEach((fn) => fn.mockClear());
  Object.values(mockHooks).forEach((fn) => fn.mockReset());
});

describe("PairScreen", () => {
  const scanner = { permission: "prompt", requestPermission: jest.fn(async () => undefined), onBarcodeScanned: jest.fn(), rescan: jest.fn() };
  const form = (overrides: object = {}) => ({
    draft: EMPTY_PAIRING_DRAFT,
    errors: {},
    message: null,
    status: "idle",
    setField: jest.fn(),
    applyLink: jest.fn(),
    submit: jest.fn(),
    ...overrides,
  });

  it("offers the scanner and the manual form", async () => {
    const pair = jest.fn();
    mockHooks.pair.mockReturnValue({ nav: mockNav, form: form(), scanner, pair, fromLink: false, canRescan: false });
    await render(<PairScreen />);

    expect(screen.getByText("Scan the pairing code")).toBeOnTheScreen();
    expect(screen.getByText("Or enter it by hand")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Allow camera"));
    expect(scanner.requestPermission).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Pair sandbox"));
    expect(pair).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Close"));
    expect(mockNav.back).toHaveBeenCalled();
  });

  it("warns about links and offers a rescan after an error", async () => {
    mockHooks.pair.mockReturnValue({ nav: mockNav, form: form(), scanner, pair: jest.fn(), fromLink: true, canRescan: false });
    await render(<PairScreen />);
    expect(screen.getByText("Opened from a pairing link")).toBeOnTheScreen();
    expect(screen.getByText("Check the details")).toBeOnTheScreen();
    expect(screen.queryByText("Scan the pairing code")).toBeNull();

    mockHooks.pair.mockReturnValue({
      nav: mockNav,
      form: form({ message: "Not a pairing link", status: "error" }),
      scanner: { ...scanner, permission: "granted" },
      pair: jest.fn(),
      fromLink: false,
      canRescan: true,
    });
    await render(<PairScreen />);
    await fireEvent.press(screen.getByLabelText("Scan again"));
    expect(scanner.rescan).toHaveBeenCalled();
    expect(screen.getByText("Not a pairing link")).toBeOnTheScreen();
  });
});

describe("AgentRunScreen", () => {
  const runScreen = (overrides: object = {}) => ({
    nav: mockNav,
    run: sampleAgentRun,
    events: sampleAgentRunEvents,
    running: true,
    badge: { label: "Running", tone: "info" },
    cost: null,
    canContinue: false,
    composer: composer(),
    headerActions: [headerAction("Stop run")],
    isLoading: false,
    loadError: null,
    streamError: null,
    cancelError: null,
    retry: jest.fn(),
    ...overrides,
  });

  it("starts a new run for the new route with a normalised project", async () => {
    mockParams = { id: "new", projectId: "Electron-Hello" };
    const state = composer({ projectId: "electron-hello" });
    mockHooks.newAgentRun.mockReturnValue({ nav: mockNav, composer: state, projectOptions: [{ id: "electron-hello", label: "electron-hello" }] });
    await render(<AgentRunScreen />);

    expect(mockHooks.newAgentRun).toHaveBeenCalledWith("electron-hello");
    expect(screen.getByText("Ask Claude")).toBeOnTheScreen();
    expect(screen.getByLabelText("Project for this run")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Start run"));
    expect(state.submit).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("electron-hello"));
    expect(state.toggleProject).toHaveBeenCalledWith("electron-hello");
  });

  it("streams a running run's events", async () => {
    mockParams = { id: sampleAgentRun.id };
    mockHooks.agentRun.mockReturnValue(runScreen());
    await render(<AgentRunScreen />);

    expect(mockHooks.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);
    expect(screen.getByText(sampleAgentRun.prompt)).toBeOnTheScreen();
    expect(screen.getByText("Starting the build.")).toBeOnTheScreen();
    expect(screen.getByText("Running")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Continue")).toBeNull();
  });

  it("shows the outcome, cost, stream problems and a continue box for a finished run", async () => {
    const retry = jest.fn();
    mockParams = { id: sampleAgentRun.id };
    mockHooks.agentRun.mockReturnValue(
      runScreen({
        run: { ...sampleAgentRun, state: "failed", result: "Partial installer", error: "wine crashed" },
        running: false,
        cost: "$0.42",
        canContinue: true,
        streamError: "Stream dropped",
        cancelError: "Cancel failed",
        retry,
      }),
    );
    await render(<AgentRunScreen />);

    expect(screen.getByText("Partial installer")).toBeOnTheScreen();
    expect(screen.getByText("wine crashed")).toBeOnTheScreen();
    expect(screen.getByText("Cost $0.42")).toBeOnTheScreen();
    expect(screen.getByText("Cancel failed")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Reconnect"));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByLabelText("Continue")).toBeOnTheScreen();
  });

  it("shows loading and load errors before the run arrives", async () => {
    mockParams = { id: [sampleAgentRun.id, "ignored"] };
    mockHooks.agentRun.mockReturnValue(runScreen({ run: undefined, badge: undefined, events: [] }));
    await render(<AgentRunScreen />);
    expect(screen.getByLabelText("Loading run…")).toBeOnTheScreen();
    expect(mockHooks.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);

    const retry = jest.fn();
    mockHooks.agentRun.mockReturnValue(runScreen({ run: undefined, badge: undefined, loadError: "Not found", retry }));
    await render(<AgentRunScreen />);
    await fireEvent.press(screen.getByLabelText("Try again"));
    expect(retry).toHaveBeenCalled();
  });
});

describe("BuildScreen", () => {
  const detail = (overrides: object = {}) => ({
    nav: mockNav,
    build: sampleBuild,
    title: "Windows installer",
    subtitle: "electron-hello · Release",
    meta: "5m · 10m ago",
    badge: { label: "Succeeded", tone: "success" },
    active: false,
    isLoading: false,
    error: null,
    retry: jest.fn(),
    logs: { lines: [], state: "closed", exitCode: 0, error: null, reconnect: jest.fn() },
    headerActions: [],
    cancelError: null,
    downloads: { download: jest.fn(), pendingId: null, error: null },
    ...overrides,
  });

  it("lists artifacts of a finished build and downloads them", async () => {
    mockParams = { id: sampleBuild.id };
    const state = detail();
    mockHooks.build.mockReturnValue(state);
    await render(<BuildScreen />);

    expect(mockHooks.build).toHaveBeenCalledWith(sampleBuild.id);
    expect(screen.getByText("5m · 10m ago")).toBeOnTheScreen();
    expect(screen.getByText("No log output.")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Build progress")).toBeNull();
    await fireEvent.press(screen.getByLabelText(`Download ${sampleArtifact.fileName}`));
    expect(state.downloads.download).toHaveBeenCalledWith(sampleArtifact.id);
  });

  it("shows progress and every error while active", async () => {
    mockParams = { id: sampleBuild.id };
    mockHooks.build.mockReturnValue(
      detail({
        build: { ...sampleBuild, state: "running", error: "exit 2", artifacts: [] },
        active: true,
        meta: undefined,
        cancelError: "Cancel refused",
        downloads: { download: jest.fn(), pendingId: null, error: "Download refused" },
      }),
    );
    await render(<BuildScreen />);
    expect(screen.getByLabelText("Build progress")).toBeOnTheScreen();
    expect(screen.getByText("exit 2")).toBeOnTheScreen();
    expect(screen.getByText("Cancel refused")).toBeOnTheScreen();
    expect(screen.getByText("Download refused")).toBeOnTheScreen();
    expect(screen.getByText("Waiting for output…")).toBeOnTheScreen();
  });

  it("shows loading and load errors", async () => {
    mockHooks.build.mockReturnValue(detail({ build: undefined, badge: undefined }));
    await render(<BuildScreen />);
    expect(mockHooks.build).toHaveBeenCalledWith("");
    expect(screen.getByLabelText("Loading build…")).toBeOnTheScreen();

    const retry = jest.fn();
    mockHooks.build.mockReturnValue(detail({ build: undefined, badge: undefined, error: "Gone", retry }));
    await render(<BuildScreen />);
    await fireEvent.press(screen.getByLabelText("Try again"));
    expect(retry).toHaveBeenCalled();
  });
});

describe("DisplayScreen", () => {
  const display = (overrides: object = {}) => ({
    session: session(),
    headerActions: [],
    subtitle: ":1 · 1600×900",
    badge: { label: "Connected", tone: "success" },
    outage: null,
    statusError: null,
    statusLoading: false,
    rechecking: false,
    recheck: jest.fn(),
    ...overrides,
  });

  it("hosts the VNC page", async () => {
    mockHooks.display.mockReturnValue(display());
    await render(<DisplayScreen />);
    expect(screen.getByTestId("webview")).toBeOnTheScreen();
    expect(screen.getByText(":1 · 1600×900")).toBeOnTheScreen();
  });

  it("explains an outage and rechecks", async () => {
    const recheck = jest.fn();
    mockHooks.display.mockReturnValue(display({ outage: { reason: "vnc", title: "VNC is down", message: "Restart it" }, recheck }));
    await render(<DisplayScreen />);
    await fireEvent.press(screen.getByLabelText("Check again"));
    expect(recheck).toHaveBeenCalled();
    expect(screen.queryByTestId("webview")).toBeNull();
  });

  it("reports an unreachable display only when no page is open", async () => {
    mockHooks.display.mockReturnValue(display({ statusError: "Can't reach", session: session({ url: null }) }));
    await render(<DisplayScreen />);
    expect(screen.getByText("Couldn't reach the display")).toBeOnTheScreen();

    mockHooks.display.mockReturnValue(display({ statusError: "Can't reach" }));
    await render(<DisplayScreen />);
    expect(screen.getByTestId("webview")).toBeOnTheScreen();
  });
});

describe("ProjectScreen", () => {
  const detail = (overrides: object = {}) => ({
    nav: mockNav,
    project: sampleProject,
    subtitle: "Electron · main · clean",
    isLoading: false,
    error: null,
    retry: jest.fn(),
    headerActions: [headerAction("Open a shell in this project")],
    git: sampleGitDetails,
    scripts: [{ script: "start", command: "npm run start" }],
    preferDisplay: true,
    runScript: jest.fn(),
    runningScript: null,
    targets: buildTargetOptions(["electron-windows"]),
    build: jest.fn(),
    buildingTarget: null,
    processes: [sampleProcess],
    stopProcess: jest.fn(),
    stoppingId: null,
    logsId: null,
    toggleLogs: jest.fn(),
    logs: { lines: [], state: "idle", exitCode: undefined, error: null, reconnect: jest.fn() },
    builds: [sampleBuild],
    artifacts: [sampleArtifact],
    downloads: { download: jest.fn(), pendingId: null, error: null },
    actionError: null,
    ...overrides,
  });

  it("wires scripts, builds, processes, recent builds and artifacts", async () => {
    mockParams = { id: sampleProject.id, process: sampleProcess.id };
    const state = detail();
    mockHooks.project.mockReturnValue(state);
    await render(<ProjectScreen />);

    expect(mockHooks.project).toHaveBeenCalledWith(sampleProject.id, sampleProcess.id);
    expect(screen.getByText("Git")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Run start"));
    expect(state.runScript).toHaveBeenCalledWith("start", true);
    await fireEvent.press(screen.getByLabelText("Build Windows installer"));
    expect(state.build).toHaveBeenCalledWith("electron-windows", "debug");
    await fireEvent.press(screen.getByLabelText(`Stop ${sampleProcess.name}`));
    expect(state.stopProcess).toHaveBeenCalledWith(sampleProcess.id);
    await fireEvent.press(screen.getByLabelText("Logs"));
    expect(state.toggleLogs).toHaveBeenCalledWith(sampleProcess.id);
    await fireEvent.press(screen.getByLabelText(/^Windows installer, electron-hello/));
    expect(mockNav.build).toHaveBeenCalledWith(sampleBuild.id);
    await fireEvent.press(screen.getByLabelText(`Download ${sampleArtifact.fileName}`));
    expect(state.downloads.download).toHaveBeenCalledWith(sampleArtifact.id);
  });

  it("shows empty sections, inline logs and errors", async () => {
    mockParams = { id: sampleProject.id };
    mockHooks.project.mockReturnValue(
      detail({
        project: { ...sampleProject, git: null },
        scripts: [],
        targets: [],
        processes: [sampleProcess],
        logsId: sampleProcess.id,
        logs: { lines: [], state: "open", exitCode: undefined, error: "Log stream closed", reconnect: jest.fn() },
        builds: [],
        artifacts: [],
        actionError: "Build refused",
      }),
    );
    await render(<ProjectScreen />);

    expect(mockHooks.project).toHaveBeenCalledWith(sampleProject.id, null);
    expect(screen.queryByText("Git")).toBeNull();
    expect(screen.getByText("No package scripts found.")).toBeOnTheScreen();
    expect(screen.getByText("No build targets detected.")).toBeOnTheScreen();
    expect(screen.getByText("No artifacts yet.")).toBeOnTheScreen();
    expect(screen.queryByText("Recent builds")).toBeNull();
    expect(screen.getByText("Log stream closed")).toBeOnTheScreen();
    expect(screen.getByLabelText("Hide logs")).toBeOnTheScreen();
    expect(screen.getByText("Build refused")).toBeOnTheScreen();
  });

  it("shows a download error above the artifacts", async () => {
    mockParams = { id: sampleProject.id };
    mockHooks.project.mockReturnValue(detail({ downloads: { download: jest.fn(), pendingId: sampleArtifact.id, error: "Download refused" } }));
    await render(<ProjectScreen />);
    expect(screen.getByText("Download refused")).toBeOnTheScreen();
    expect(screen.getByLabelText(`Download ${sampleArtifact.fileName}`).props.accessibilityState.busy).toBe(true);
  });

  it("shows loading and load errors", async () => {
    mockHooks.project.mockReturnValue(detail({ project: undefined }));
    await render(<ProjectScreen />);
    expect(screen.getByLabelText("Loading project…")).toBeOnTheScreen();

    const retry = jest.fn();
    mockHooks.project.mockReturnValue(detail({ project: undefined, error: "No such project", retry }));
    await render(<ProjectScreen />);
    await fireEvent.press(screen.getByLabelText("Try again"));
    expect(retry).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(mockNav.back).toHaveBeenCalled();
  });
});

describe("NewProjectScreen", () => {
  it("renders the new project form", async () => {
    mockHooks.newProject.mockReturnValue({
      nav: mockNav,
      form: {
        draft: { name: "", gitUrl: "", branch: "" },
        errors: {},
        setField: jest.fn(),
        submit: jest.fn(),
        submitting: false,
        submitLabel: "Create project",
        locationHint: "hint",
        error: null,
      },
      clone: null,
    });
    await render(<NewProjectScreen />);
    expect(screen.getByText("New project")).toBeOnTheScreen();
  });
});

describe("TerminalScreen", () => {
  it("launches a new session of the requested kind and replaces the route when created", async () => {
    mockParams = { id: "new", kind: "claude", projectId: "electron-hello" };
    mockHooks.launcher.mockReturnValue({ error: null, isCreating: true, retry: jest.fn() });
    await render(<TerminalScreen />);

    const [launch, onCreated] = mockHooks.launcher.mock.calls[0] as [unknown, (terminal: { id: string }) => void];
    expect(launch).toEqual({ kind: "claude", projectId: "electron-hello" });
    expect(screen.getByLabelText("Starting the session…")).toBeOnTheScreen();
    onCreated({ id: "trm_new" });
    expect(mockNav.replaceWithTerminal).toHaveBeenCalledWith("trm_new");
  });

  it("offers a retry when the session cannot start", async () => {
    mockParams = { id: "new", kind: "bogus" };
    const retry = jest.fn();
    mockHooks.launcher.mockReturnValue({ error: "pty limit", isCreating: false, retry });
    await render(<TerminalScreen />);

    expect(mockHooks.launcher.mock.calls[0][0]).toEqual({ kind: "shell" });
    expect(screen.getByText("pty limit")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Try again"));
    expect(retry).toHaveBeenCalled();
  });

  it("hosts an existing session with its close error", async () => {
    mockParams = { id: "trm_1" };
    mockHooks.terminal.mockReturnValue({
      nav: mockNav,
      session: session(),
      headerActions: [headerAction("Reconnect")],
      title: "bash",
      subtitle: "/workspace",
      badge: { label: "Connected", tone: "success" },
      closeError: "Close refused",
    });
    await render(<TerminalScreen />);

    expect(mockHooks.terminal).toHaveBeenCalledWith("trm_1");
    expect(screen.getByText("bash")).toBeOnTheScreen();
    expect(screen.getByText("Close refused")).toBeOnTheScreen();
    expect(screen.getByTestId("webview")).toBeOnTheScreen();
  });

  it("omits the footer without a close error", async () => {
    mockParams = { id: "trm_1" };
    mockHooks.terminal.mockReturnValue({
      nav: mockNav,
      session: session({ url: null, isLoading: true }),
      headerActions: [],
      title: "Terminal",
      subtitle: undefined,
      badge: { label: "Loading", tone: "neutral" },
      closeError: null,
    });
    await render(<TerminalScreen />);
    expect(screen.getByText("Opening the terminal…")).toBeOnTheScreen();
  });
});
