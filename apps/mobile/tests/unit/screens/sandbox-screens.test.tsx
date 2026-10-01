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
  sampleSyncChanges,
  sampleSyncRequest,
} from "@theone/protocol/fixtures";

import PairScreen from "@/app/pair";
import AgentRunScreen from "@/app/sandbox/agent/[id]";
import BuildScreen from "@/app/sandbox/builds/[id]";
import DisplayScreen from "@/app/sandbox/display";
import ProjectScreen from "@/app/sandbox/projects/[id]";
import NewProjectScreen from "@/app/sandbox/projects/new";
import TerminalScreen from "@/app/sandbox/terminal/[id]";
import { toChatEvents } from "@/features/chat/utils/messages";
import { EMPTY_PAIRING_DRAFT } from "@/features/sandbox/utils/pairing";
import { buildTargetOptions } from "@/features/sandbox/utils/labels";
import { describeSyncRequest, SYNC_COPY } from "@/features/sandbox/utils/sync";
import { useDisplayStore } from "@/features/sandbox/store/display-store";
import { injectJavaScript } from "../../mocks/react-native-webview";
import { TEST_SITE } from "../sandbox/helpers";
import { chatComposerState } from "../chat/fixtures";

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
  browser: jest.fn(),
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(async () => undefined),
  OrientationLock: { PORTRAIT_UP: 3, LANDSCAPE: 5 },
}));
jest.mock("@/features/sandbox/hooks/use-browser-sheet", () => ({
  useBrowserSheet: (visible: boolean) => mockHooks.browser(visible),
}));
jest.mock("@/features/sandbox/hooks/use-sandbox-navigation", () => ({ useSandboxNavigation: () => mockNav }));
jest.mock("@/features/sandbox/hooks/use-pair-screen", () => ({ usePairScreen: () => mockHooks.pair() }));
jest.mock("@/features/attachments/hooks/use-upload-source", () => ({
  useUploadSource: () => ({ uri: "http://127.0.0.1:7700/v1/uploads/upl/content", headers: { Authorization: "Bearer t" } }),
}));
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
    messages: toChatEvents(sampleAgentRunEvents),
    running: true,
    badge: { label: "Running", tone: "info" },
    result: null,
    brief: null,
    canContinue: false,
    composer: chatComposerState(),
    headerActions: [headerAction("Stop run")],
    isLoading: false,
    loadError: null,
    streamError: null,
    cancelError: null,
    syncNotice: null,
    dismissSyncNotice: jest.fn(),
    retry: jest.fn(),
    ...overrides,
  });

  it("starts a new run for the new route with a normalised project", async () => {
    mockParams = { id: "new", projectId: "Electron-Hello" };
    const selectProject = jest.fn();
    const state = chatComposerState({
      projectId: "electron-hello",
      project: {
        id: "electron-hello",
        label: "electron-hello",
        options: [{ id: "electron-hello", label: "electron-hello" }],
        select: selectProject,
      },
      text: "build it",
      primary: "send",
      canSend: true,
    });
    const selectSuggestion = jest.fn();
    mockHooks.newAgentRun.mockReturnValue({
      nav: mockNav,
      composer: state,
      projectOptions: [{ id: "electron-hello", label: "electron-hello" }],
      greeting: "Hello, Ada\nHow can I help you?",
      suggestions: { visible: true, items: [{ id: "api", label: "Build a REST API" }], select: selectSuggestion },
    });
    await render(<AgentRunScreen />);

    expect(mockHooks.newAgentRun).toHaveBeenCalledWith("electron-hello");
    expect(screen.getByText(/Hello, Ada/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Build a REST API"));
    expect(selectSuggestion).toHaveBeenCalledWith({ id: "api", label: "Build a REST API" });
    await fireEvent.press(screen.getByLabelText("Send"));
    expect(state.send).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("electron-hello"));
    expect(state.openSheet).toHaveBeenCalledWith("project");
    await fireEvent.press(screen.getByLabelText("Auto"));
    expect(state.openSheet).toHaveBeenCalledWith("mode");
    await fireEvent.press(screen.getByLabelText("Attach"));
    expect(state.openSheet).toHaveBeenCalledWith("attach");
  });

  it("streams a running run's events", async () => {
    mockParams = { id: sampleAgentRun.id };
    mockHooks.agentRun.mockReturnValue(runScreen());
    await render(<AgentRunScreen />);

    expect(mockHooks.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);
    expect(screen.getByText(sampleAgentRun.prompt)).toBeOnTheScreen();
    expect(screen.getByText("Starting the build.")).toBeOnTheScreen();
    expect(screen.getByText("Running")).toBeOnTheScreen();
    expect(screen.queryByTestId("run-composer")).toBeNull();
    expect(screen.getAllByText("Claude").length).toBeGreaterThan(0);
  });

  it("shows the outcome, a one-line brief, stream problems and a continue box for a finished run", async () => {
    const retry = jest.fn();
    mockParams = { id: sampleAgentRun.id };
    mockHooks.agentRun.mockReturnValue(
      runScreen({
        run: { ...sampleAgentRun, state: "failed", result: "Partial installer", error: "wine crashed" },
        running: false,
        result: "Partial installer",
        brief: "Failed in 5m · 12.3k tokens · 8k in · 4.3k out",
        canContinue: true,
        streamError: "Stream dropped",
        cancelError: "Cancel failed",
        retry,
      }),
    );
    await render(<AgentRunScreen />);

    expect(screen.getByText("Partial installer")).toBeOnTheScreen();
    expect(screen.getByText("wine crashed")).toBeOnTheScreen();
    expect(screen.getByTestId("run-brief")).toHaveTextContent("Failed in 5m · 12.3k tokens · 8k in · 4.3k out");
    expect(screen.getByText("Cancel failed")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Reconnect"));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByTestId("run-composer")).toBeOnTheScreen();
    expect(screen.getByLabelText("Record voice message")).toBeOnTheScreen();
  });

  it("offers Sync to host next to Reload and shows its progress", async () => {
    const sync = jest.fn();
    const dismissSyncNotice = jest.fn();
    mockParams = { id: sampleAgentRun.id };
    mockHooks.agentRun.mockReturnValue(
      runScreen({
        running: false,
        headerActions: [headerAction("Reload"), headerAction("Sync to host", sync)],
        syncNotice: { tone: "success", title: "Synced to host", message: "1 added · 1 modified · 1 deleted" },
        dismissSyncNotice,
      }),
    );
    await render(<AgentRunScreen />);

    expect(screen.getByLabelText("Reload")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Sync to host"));
    expect(sync).toHaveBeenCalled();
    expect(screen.getByText("Synced to host")).toBeOnTheScreen();
    expect(screen.getByText("1 added · 1 modified · 1 deleted")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(dismissSyncNotice).toHaveBeenCalled();
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
  const CURRENT_TAB = { id: "t1", title: "Vite App", url: "http://localhost:5173/", phoneUrl: "http://100.64.0.1:5173/" };
  const OTHER_TAB = { id: "t2", title: "Docs", url: "https://docs.expo.dev/", phoneUrl: "https://docs.expo.dev/" };
  const browser = (overrides: object = {}) => ({
    summary: { kind: "tabs", current: CURRENT_TAB, others: [OTHER_TAB] },
    loading: false,
    refreshing: false,
    error: null,
    openError: null,
    refresh: jest.fn(),
    open: jest.fn(),
    share: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    injectJavaScript.mockClear();
    useDisplayStore.setState({ inputMode: "trackpad" });
    mockHooks.browser.mockReturnValue(browser());
  });

  it("hosts the VNC page under a floating bar", async () => {
    mockHooks.display.mockReturnValue(display());
    await render(<DisplayScreen />);
    expect(screen.getByTestId("webview")).toBeOnTheScreen();
    expect(screen.getByText(":1 · 1600×900")).toBeOnTheScreen();
    expect(screen.getByText("Connected")).toBeOnTheScreen();
    for (const label of ["Go back", "Trackpad mode. Switch to touch mode", "Show the browser's page", "Rotate screen", "Full screen"]) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(mockNav.back).toHaveBeenCalled();
  });

  it("pushes the insets and the input mode into the connected page", async () => {
    mockHooks.display.mockReturnValue(display());
    await render(<DisplayScreen />);
    const scripts = injectJavaScript.mock.calls.map(([script]) => String(script));
    expect(scripts.some((script) => script.includes('t.setInputMode("trackpad")'))).toBe(true);
    expect(scripts.some((script) => script.includes("t.setInsets({"))).toBe(true);
  });

  it("switches and remembers the input mode", async () => {
    mockHooks.display.mockReturnValue(display());
    await render(<DisplayScreen />);
    await fireEvent.press(screen.getByLabelText("Trackpad mode. Switch to touch mode"));
    expect(useDisplayStore.getState().inputMode).toBe("touch");
    expect(screen.getByLabelText("Touch mode. Switch to trackpad mode")).toBeOnTheScreen();
    expect(injectJavaScript).toHaveBeenLastCalledWith(expect.stringContaining('t.setInputMode("touch")'));
  });

  it("goes full screen behind a single exit button", async () => {
    mockHooks.display.mockReturnValue(display());
    await render(<DisplayScreen />);
    await fireEvent.press(screen.getByLabelText("Full screen"));
    expect(screen.queryByLabelText("Go back")).toBeNull();
    expect(injectJavaScript).toHaveBeenCalledWith(expect.stringContaining('"top":0'));

    await fireEvent.press(screen.getByLabelText("Exit full screen"));
    expect(screen.getByLabelText("Go back")).toBeOnTheScreen();
  });

  it("shows the browser's current page and opens or shares its phone URL", async () => {
    const sheet = browser();
    mockHooks.browser.mockReturnValue(sheet);
    mockHooks.display.mockReturnValue(display());
    await render(<DisplayScreen />);
    expect(mockHooks.browser).toHaveBeenLastCalledWith(false);

    await fireEvent.press(screen.getByLabelText("Show the browser's page"));
    expect(mockHooks.browser).toHaveBeenLastCalledWith(true);
    expect(screen.getByText("Vite App")).toBeOnTheScreen();
    expect(screen.getByText("http://localhost:5173/")).toBeOnTheScreen();
    expect(screen.getByText("http://100.64.0.1:5173/")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Open"));
    expect(sheet.open).toHaveBeenCalledWith(CURRENT_TAB);
    await fireEvent.press(screen.getByLabelText("Share"));
    expect(sheet.share).toHaveBeenCalledWith(CURRENT_TAB);
    await fireEvent.press(screen.getByLabelText("Share Docs"));
    expect(sheet.share).toHaveBeenCalledWith(OTHER_TAB);
  });

  it("explains a localhost page without a Tailscale address and a browser without debugging", async () => {
    mockHooks.display.mockReturnValue(display());
    mockHooks.browser.mockReturnValue(browser({ summary: { kind: "tabs", current: { ...CURRENT_TAB, phoneUrl: null }, others: [] } }));
    await render(<DisplayScreen />);
    await fireEvent.press(screen.getByLabelText("Show the browser's page"));
    expect(screen.getByText(/no Tailscale address/)).toBeOnTheScreen();

    mockHooks.browser.mockReturnValue(browser({ summary: { kind: "unavailable" } }));
    await render(<DisplayScreen />);
    await fireEvent.press(screen.getByLabelText("Show the browser's page"));
    expect(screen.getByText("Can't read Chromium's tabs")).toBeOnTheScreen();
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
  const syncState = (overrides: object = {}) => ({
    loading: false,
    loadError: null,
    actionError: null,
    host: "Monolith on workstation · online",
    empty: null,
    changes: sampleSyncChanges.changes,
    summary: "3 files · 1 added · 1 modified · 1 deleted",
    confirmMessage: "3 files. A snapshot is taken first, so you can revert it.",
    files: sampleSyncChanges.changes,
    fileToggleLabel: null,
    toggleExpanded: jest.fn(),
    canSync: true,
    syncing: false,
    canRevert: true,
    reverting: false,
    revert: jest.fn(),
    showForce: false,
    force: false,
    setForce: jest.fn(),
    sheetOpen: false,
    openSheet: jest.fn(),
    closeSheet: jest.fn(),
    submit: jest.fn(),
    requests: [{ id: sampleSyncRequest.id, view: describeSyncRequest(sampleSyncRequest) }],
    cancel: jest.fn(),
    cancellingId: null,
    ...overrides,
  });
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
    sites: [],
    siteFor: jest.fn(() => undefined),
    openSite: jest.fn(),
    siteError: null,
    processes: [sampleProcess],
    stopProcess: jest.fn(),
    stoppingId: null,
    logsId: null,
    toggleLogs: jest.fn(),
    logs: { lines: [], state: "idle", exitCode: undefined, error: null, reconnect: jest.fn() },
    builds: [sampleBuild],
    artifacts: [sampleArtifact],
    downloads: { download: jest.fn(), pendingId: null, error: null },
    sync: syncState(),
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

  it("lists the project's websites and opens them in the browser", async () => {
    mockParams = { id: sampleProject.id };
    const state = detail({ sites: [TEST_SITE], siteFor: jest.fn(() => TEST_SITE), siteError: "Can't open that link" });
    mockHooks.project.mockReturnValue(state);
    await render(<ProjectScreen />);

    expect(screen.getByTestId("project-sites")).toBeOnTheScreen();
    expect(screen.getByText(TEST_SITE.url!)).toBeOnTheScreen();
    expect(screen.getByText("Can't open that link")).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByLabelText("Open :5173 in browser")[0]);
    expect(state.openSite).toHaveBeenCalledWith(TEST_SITE.url);
    expect(screen.getAllByLabelText("Open :5173 in browser")).toHaveLength(2);
    expect(state.siteFor).toHaveBeenCalledWith(sampleProcess.id);
  });

  it("hides the websites section when nothing listens", async () => {
    mockParams = { id: sampleProject.id };
    mockHooks.project.mockReturnValue(detail());
    await render(<ProjectScreen />);
    expect(screen.queryByTestId("project-sites")).toBeNull();
  });

  it("shows a download error above the artifacts", async () => {
    mockParams = { id: sampleProject.id };
    mockHooks.project.mockReturnValue(detail({ downloads: { download: jest.fn(), pendingId: sampleArtifact.id, error: "Download refused" } }));
    await render(<ProjectScreen />);
    expect(screen.getByText("Download refused")).toBeOnTheScreen();
    expect(screen.getByLabelText(`Download ${sampleArtifact.fileName}`).props.accessibilityState.busy).toBe(true);
  });

  it("lists sync-back changes and opens the confirm sheet", async () => {
    mockParams = { id: sampleProject.id };
    const sync = syncState({ fileToggleLabel: "Show all 12 files" });
    mockHooks.project.mockReturnValue(detail({ sync }));
    await render(<ProjectScreen />);

    expect(screen.getByTestId("project-sync")).toBeOnTheScreen();
    expect(screen.getByText("Monolith on workstation · online")).toBeOnTheScreen();
    expect(screen.getByText(sync.summary)).toBeOnTheScreen();
    expect(screen.getByLabelText("added src/new-file.ts")).toBeOnTheScreen();
    expect(screen.getByText(/^Synced 3 files/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Show all 12 files"));
    expect(sync.toggleExpanded).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Sync to host"));
    expect(sync.openSheet).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Revert last sync"));
    expect(sync.revert).toHaveBeenCalled();
  });

  it("confirms a sync with the force toggle after conflicts", async () => {
    mockParams = { id: sampleProject.id };
    const sync = syncState({ sheetOpen: true, showForce: true });
    mockHooks.project.mockReturnValue(detail({ sync }));
    await render(<ProjectScreen />);

    expect(screen.getByTestId("sync-confirm-sheet")).toBeOnTheScreen();
    await fireEvent(screen.getByLabelText("Overwrite host edits"), "valueChange", true);
    expect(sync.setForce).toHaveBeenCalledWith(true);
    await fireEvent.press(screen.getByLabelText("Sync 3 files"));
    expect(sync.submit).toHaveBeenCalled();
  });

  it("shows pending requests with cancel, conflicts and empty states", async () => {
    mockParams = { id: sampleProject.id };
    const pending = { ...sampleSyncRequest, id: "sync_pending", status: "pending" as const, result: null };
    const failed = {
      ...sampleSyncRequest,
      id: "sync_failed",
      status: "failed" as const,
      error: "1 file changed on the host",
      result: { added: 0, modified: 0, deleted: 0, conflicts: ["src/main.ts"], snapshotId: null, hostPath: null },
    };
    const sync = syncState({
      empty: "up-to-date",
      changes: [],
      files: [],
      canRevert: false,
      requests: [pending, failed].map((request) => ({ id: request.id, view: describeSyncRequest(request) })),
    });
    mockHooks.project.mockReturnValue(detail({ sync }));
    await render(<ProjectScreen />);

    expect(screen.getByText(SYNC_COPY.upToDate)).toBeOnTheScreen();
    expect(screen.queryByLabelText("Sync to host")).toBeNull();
    expect(screen.queryByLabelText("Revert last sync")).toBeNull();
    expect(screen.getByText(SYNC_COPY.pending)).toBeOnTheScreen();
    expect(screen.getByText("1 file changed on the host")).toBeOnTheScreen();
    expect(screen.getByText("src/main.ts")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Cancel Sync all changes"));
    expect(sync.cancel).toHaveBeenCalledWith("sync_pending");

    mockHooks.project.mockReturnValue(detail({ sync: syncState({ empty: "never-pushed", changes: [], files: [], requests: [] }) }));
    await render(<ProjectScreen />);
    expect(screen.getByText(SYNC_COPY.neverPushed)).toBeOnTheScreen();
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
