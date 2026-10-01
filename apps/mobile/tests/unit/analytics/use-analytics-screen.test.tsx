import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import { sampleProject } from "@theone/protocol/fixtures";

import { useAnalyticsScreen } from "@/features/analytics/hooks/use-analytics-screen";
import { useProjectAnalytics } from "@/features/analytics/hooks/use-project-analytics";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";
import { datesEnding, day, emptyWeekReport, report, weekReport, weekSessions } from "./fixtures";

const mockPush = jest.fn();

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  router: { push: (...args: unknown[]) => mockPush(...args), canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
}));

const MockClient = TheOneClient as unknown as jest.Mock;
const fake = {
  usage: jest.fn(),
  sessions: jest.fn(),
  listProjects: jest.fn(),
};

const fourteen = report(datesEnding("2026-09-24", 14).map((date, index) => day(date, index < 7 ? 500 : 0)));

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockPush.mockReset();
  fake.usage.mockReset().mockImplementation(async ({ days }: { days: number }) => (days === 14 ? fourteen : { ...weekReport, days }));
  fake.sessions.mockReset().mockResolvedValue(weekSessions);
  fake.listProjects.mockReset().mockResolvedValue([{ ...sampleProject, id: "electron-hello", name: "Electron Hello" }]);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useAnalyticsScreen", () => {
  it("loads the range and twice the range for the comparison", async () => {
    const { result } = await renderHook(() => useAnalyticsScreen(), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.view).not.toBeNull());

    expect(fake.usage).toHaveBeenCalledWith({ days: 30 }, { signal: expect.any(Object) });
    expect(fake.usage).toHaveBeenCalledWith({ days: 60 }, { signal: expect.any(Object) });
    expect(fake.sessions).toHaveBeenCalledWith({ limit: 200 }, { signal: expect.any(Object) });
    await waitFor(() => expect(result.current.view?.projects[0].label).toBe("Electron Hello"));

    await act(async () => result.current.range.select("7"));
    await waitFor(() => expect(result.current.view?.headline.delta).toEqual({ kind: "up", ratio: expect.any(Number) }));
    expect(fake.usage).toHaveBeenCalledWith({ days: 14 }, { signal: expect.any(Object) });

    await act(async () => result.current.openProject("electron-hello"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/analytics/projects/[id]", params: { id: "electron-hello", days: "7" } });
  });

  it("skips the comparison for 90 days and flags an empty report", async () => {
    fake.usage.mockImplementation(async ({ days }: { days: number }) => ({ ...emptyWeekReport, days }));
    const { result } = await renderHook(() => useAnalyticsScreen(), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => result.current.range.select("90"));
    await waitFor(() => expect(result.current.empty).toBe(true));
    expect(fake.usage).not.toHaveBeenCalledWith({ days: 180 }, expect.anything());
  });

  it("surfaces a load error", async () => {
    fake.usage.mockRejectedValue(new Error("boom"));
    const { result } = await renderHook(() => useAnalyticsScreen(), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe("boom"));
  });
});

describe("useProjectAnalytics", () => {
  it("filters sessions by project and starts from the passed range", async () => {
    const { result } = await renderHook(() => useProjectAnalytics("electron-hello", "7"), {
      wrapper: createWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(result.current.view).not.toBeNull());
    expect(result.current.range.days).toBe(7);
    expect(fake.usage).toHaveBeenCalledWith({ days: 7 }, { signal: expect.any(Object) });
    expect(fake.sessions).toHaveBeenCalledWith({ limit: 200, projectId: "electron-hello" }, { signal: expect.any(Object) });
    await waitFor(() => expect(result.current.title).toBe("Electron Hello"));
  });
});
