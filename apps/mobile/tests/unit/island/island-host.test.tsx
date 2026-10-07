import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { sampleAgentRun, sampleProcess, sampleProject, sampleUsageReport } from "@theone/protocol/fixtures";
import { TheOneClient } from "@theone/client";

import IslandHost from "@/features/island/components/island-host";
import { useIslandStore } from "@/features/island/store/island-store";
import { useSettingsStore } from "@/features/settings/store/settings-store";

import { __emitAction, __reset as resetIsland, startActivity } from "../../mocks/theone-island";
import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

let mockPathname = "/";
const mockNav = { agentRun: jest.fn(), sandboxHub: jest.fn(), newAgentRun: jest.fn() };

jest.mock("expo-router", () => ({ useIsFocused: () => true, usePathname: () => mockPathname, router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => false, back: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("@/features/sandbox/hooks/use-sandbox-navigation", () => ({ useSandboxNavigation: () => mockNav }));

const MockClient = TheOneClient as unknown as jest.Mock;
const fake = {
  listAgentRuns: jest.fn(),
  listProcesses: jest.fn(),
  listBuilds: jest.fn(),
  listProjects: jest.fn(),
  usage: jest.fn(),
  sessions: jest.fn(),
  cancelAgentRun: jest.fn(),
  stopProcess: jest.fn(),
  cancelBuild: jest.fn(),
  registerLiveActivity: jest.fn(),
};

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  resetIsland();
  mockPathname = "/";
  for (const fn of Object.values(mockNav)) fn.mockClear();
  useIslandStore.getState().reset();
  useSettingsStore.setState({ islandPlacement: "bottomRight", liveActivity: true });
  for (const fn of Object.values(fake)) fn.mockReset();
  fake.listAgentRuns.mockResolvedValue([sampleAgentRun]);
  fake.listProcesses.mockResolvedValue([sampleProcess]);
  fake.listBuilds.mockResolvedValue([]);
  fake.listProjects.mockResolvedValue([sampleProject]);
  fake.usage.mockResolvedValue(sampleUsageReport);
  fake.sessions.mockResolvedValue([]);
  fake.cancelAgentRun.mockResolvedValue({ ...sampleAgentRun, state: "cancelled" });
  fake.stopProcess.mockResolvedValue({ ...sampleProcess, state: "stopped" });
  MockClient.mockReset().mockImplementation(() => fake);
});

afterEach(() => jest.restoreAllMocks());

const renderHost = () => render(<IslandHost />, { wrapper: createWrapper(createTestQueryClient()) });

describe("<IslandHost />", () => {
  it("stays hidden without work and shows the capsule once a run is running", async () => {
    fake.listAgentRuns.mockResolvedValue([]);
    fake.listProcesses.mockResolvedValue([]);
    await renderHost();
    expect(screen.queryByTestId("island-host")).toBeNull();
  });

  it("collapsed capsule opens into the panel with the primary run, usage and controls", async () => {
    await renderHost();
    const capsule = await screen.findByTestId("island-capsule");
    expect(screen.getByLabelText("Claude is working, 2 tasks")).toBeOnTheScreen();
    expect(screen.getByText("2 tasks")).toBeOnTheScreen();

    await fireEvent.press(capsule);
    expect(screen.getByTestId("island-panel")).toBeOnTheScreen();
    expect(screen.getByText("Test box")).toBeOnTheScreen();
    expect(screen.getByText("68.4k today")).toBeOnTheScreen();
    expect(screen.getByText("Build the Windows installer")).toBeOnTheScreen();
    expect(screen.getByText("+1")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Build the Windows installer"));
    expect(mockNav.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);
    expect(useIslandStore.getState().expanded).toBe(false);

    await fireEvent.press(screen.getByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Stop Build the Windows installer"));
    expect(fake.cancelAgentRun).toHaveBeenCalledWith(sampleAgentRun.id);
    expect(fake.stopProcess).not.toHaveBeenCalled();
  });

  it("stops the running command when no run is live", async () => {
    fake.listAgentRuns.mockResolvedValue([]);
    await renderHost();
    await fireEvent.press(await screen.findByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Stop dev"));
    expect(fake.stopProcess).toHaveBeenCalledWith(sampleProcess.id);
    await waitFor(() => expect(screen.queryByTestId("island-host")).toBeNull());
  });

  it("dismisses on the backdrop and opens the capture flow from the panel", async () => {
    await renderHost();
    await fireEvent.press(await screen.findByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(screen.queryByTestId("island-panel")).toBeNull();

    await fireEvent.press(screen.getByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Capture"));
    expect(useIslandStore.getState().captureOpen).toBe(true);
    expect(screen.queryByTestId("island-host")).toBeNull();
  });

  it("opens the latest run's chat from the panel", async () => {
    await renderHost();
    await fireEvent.press(await screen.findByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Open chat"));
    expect(mockNav.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);
    expect(mockNav.sandboxHub).not.toHaveBeenCalled();
    expect(useIslandStore.getState().expanded).toBe(false);
  });

  it("lists the other running chats and opens the one tapped", async () => {
    const second = { ...sampleAgentRun, id: "run_second", prompt: "Fix the login screen", startedAt: "2026-01-01T00:00:00.000Z" };
    fake.listAgentRuns.mockResolvedValue([sampleAgentRun, second]);
    fake.listProcesses.mockResolvedValue([]);
    await renderHost();
    await fireEvent.press(await screen.findByTestId("island-capsule"));

    expect(screen.getByText("Fix the login screen")).toBeOnTheScreen();
    expect(screen.queryByText("+1")).toBeNull();
    await fireEvent.press(screen.getByTestId("island-chat-run_second"));
    expect(mockNav.agentRun).toHaveBeenCalledWith("run_second");
    expect(useIslandStore.getState().expanded).toBe(false);
  });

  it("only folds the island when the chat is already on screen", async () => {
    mockPathname = `/sandbox/agent/${sampleAgentRun.id}`;
    await renderHost();
    await fireEvent.press(await screen.findByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Open chat"));
    expect(mockNav.agentRun).not.toHaveBeenCalled();
    expect(useIslandStore.getState().expanded).toBe(false);
  });

  it("opens a new chat when only commands are running", async () => {
    fake.listAgentRuns.mockResolvedValue([]);
    await renderHost();
    await fireEvent.press(await screen.findByTestId("island-capsule"));
    expect(screen.getAllByText("dev").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText("Open chat"));
    expect(mockNav.newAgentRun).toHaveBeenCalled();
  });

  it("stops a command or a run from the Live Activity stop button", async () => {
    await renderHost();
    await screen.findByTestId("island-capsule");
    await act(async () => __emitAction({ action: "stop", runId: sampleProcess.id }));
    await waitFor(() => expect(fake.stopProcess).toHaveBeenCalledWith(sampleProcess.id));
    expect(fake.cancelAgentRun).not.toHaveBeenCalled();

    await act(async () => __emitAction({ action: "stop", runId: sampleAgentRun.id }));
    await waitFor(() => expect(fake.cancelAgentRun).toHaveBeenCalledWith(sampleAgentRun.id));
  });

  it("leaves running work to the system island when the orb is hidden", async () => {
    useSettingsStore.setState({ islandPlacement: "hidden" });
    await renderHost();
    await waitFor(() => expect(fake.listAgentRuns).toHaveBeenCalled());
    expect(screen.queryByTestId("island-host")).toBeNull();
  });

  it("starts the live activity for running work", async () => {
    await renderHost();
    await screen.findByTestId("island-capsule");
    await act(async () => {
      jest.useFakeTimers();
      jest.advanceTimersByTime(1500);
      jest.useRealTimers();
    });
    expect(startActivity).toHaveBeenCalledWith(expect.objectContaining({ sandboxId: "sbx_test", runs: [expect.objectContaining({ id: sampleAgentRun.id })] }));
  });
});
