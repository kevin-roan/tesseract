import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { sampleAgentRun, sampleProcess, sampleProject, sampleUsageReport } from "@theone/protocol/fixtures";
import { TheOneClient } from "@theone/client";

import IslandHost from "@/features/island/components/island-host";
import { useIslandStore } from "@/features/island/store/island-store";

import { __reset as resetIsland, startActivity } from "../../mocks/theone-island";
import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

const mockNav = { agentRun: jest.fn(), sandboxHub: jest.fn(), newAgentRun: jest.fn() };

jest.mock("expo-router", () => ({ useIsFocused: () => true, router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => false, back: jest.fn() } }));
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
  useIslandStore.getState().reset();
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

  it("collapsed capsule opens into the card with runs, commands, usage and actions", async () => {
    await renderHost();
    const capsule = await screen.findByTestId("island-capsule");
    expect(screen.getByText("Claude is working")).toBeOnTheScreen();
    expect(screen.getByText("2 tasks")).toBeOnTheScreen();

    await fireEvent.press(capsule);
    expect(screen.getByTestId("island-card")).toBeOnTheScreen();
    expect(screen.getByText("Test box")).toBeOnTheScreen();
    expect(screen.getByText("Build the Windows installer")).toBeOnTheScreen();
    expect(screen.getByText("dev")).toBeOnTheScreen();
    expect(screen.getByText("Today")).toBeOnTheScreen();
    expect(screen.getByLabelText("68.4k Today")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Build the Windows installer"));
    expect(mockNav.agentRun).toHaveBeenCalledWith(sampleAgentRun.id);
    expect(useIslandStore.getState().expanded).toBe(false);

    await fireEvent.press(screen.getByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Cancel dev"));
    expect(fake.stopProcess).toHaveBeenCalledWith(sampleProcess.id);
    await fireEvent.press(screen.getByLabelText("Stop Build the Windows installer"));
    expect(fake.cancelAgentRun).toHaveBeenCalledWith(sampleAgentRun.id);
    await waitFor(() => expect(screen.queryByTestId("island-host")).toBeNull());
  });

  it("dismisses on the backdrop and opens the capture flow from the card", async () => {
    await renderHost();
    await fireEvent.press(await screen.findByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(screen.queryByTestId("island-card")).toBeNull();

    await fireEvent.press(screen.getByTestId("island-capsule"));
    await fireEvent.press(screen.getByLabelText("Capture"));
    expect(useIslandStore.getState().captureOpen).toBe(true);
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
