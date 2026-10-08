import { fireEvent, render, screen, within } from "@testing-library/react-native";
import type { ClaudeSession } from "@tesseract/protocol";

import AnalyticsScreen from "@/app/analytics";
import ProjectAnalyticsScreen from "@/app/analytics/projects/[id]";
import { buildProjectView } from "@/features/analytics/utils/project-view";
import { RANGE_OPTIONS } from "@/features/analytics/utils/range";
import { buildAnalyticsView } from "@/features/analytics/utils/view-model";

import { TEST_SANDBOX } from "../sandbox/helpers";
import { emptyWeekReport, weekReport, weekSessions } from "./fixtures";

const mockAnalytics = jest.fn();
const mockProject = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams, useIsFocused: () => true }));
jest.mock("@/features/analytics/hooks/use-analytics-screen", () => ({ useAnalyticsScreen: () => mockAnalytics() }));
jest.mock("@/features/analytics/hooks/use-analytics-overview", () => ({
  useAnalyticsOverview: () => ({
    stats: [],
    usage: { range: 7, ranges: [7, 30], setRange: jest.fn(), data: null, loading: true, error: null, retry: jest.fn() },
  }),
}));
jest.mock("@/features/analytics/hooks/use-project-analytics", () => ({
  useProjectAnalytics: (id: string, days?: string) => mockProject(id, days),
}));

const agentRun = jest.fn();
const terminal = jest.fn();
const nav = {
  back: jest.fn(),
  project: jest.fn(),
  newAgentRun: jest.fn(),
  sessionPress: (session: ClaudeSession) => {
    if (session.agentRunId) return () => agentRun(session.agentRunId);
    if (session.terminalId) return () => terminal(session.terminalId);
    return undefined;
  },
};

const layout = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 200 } } });

function analytics(overrides: object = {}) {
  return {
    sandbox: TEST_SANDBOX,
    nav,
    range: { days: 7, select: jest.fn(), options: RANGE_OPTIONS },
    view: buildAnalyticsView({
      days: 7,
      report: weekReport,
      sessions: weekSessions,
      projectNames: new Map([["electron-hello", "Electron Hello"]]),
    }),
    openProject: jest.fn(),
    loading: false,
    stale: false,
    empty: false,
    error: null,
    sessionsError: null,
    sessionsLoading: false,
    retry: jest.fn(),
    retrySessions: jest.fn(),
    refreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

function project(overrides: object = {}) {
  return {
    sandbox: TEST_SANDBOX,
    nav,
    range: { days: 30, select: jest.fn(), options: RANGE_OPTIONS },
    title: "Electron Hello",
    view: buildProjectView("electron-hello", weekReport, weekSessions),
    loading: false,
    stale: false,
    error: null,
    sessionsError: null,
    sessionsLoading: false,
    retry: jest.fn(),
    retrySessions: jest.fn(),
    refreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockParams = {};
  mockAnalytics.mockReset();
  mockProject.mockReset();
  agentRun.mockReset();
  terminal.mockReset();
});

describe("AnalyticsScreen", () => {
  it("shows the headline, KPIs, breakdowns and top sessions", async () => {
    const state = analytics();
    mockAnalytics.mockReturnValue(state);
    await render(<AnalyticsScreen />);

    expect(screen.getByText("Analytics")).toBeOnTheScreen();
    expect(screen.getByText("Tokens, last 7 days")).toBeOnTheScreen();
    expect(within(screen.getByTestId("analytics-headline")).getByText("11.6K")).toBeOnTheScreen();
    expect(screen.getByText("Output tokens")).toBeOnTheScreen();
    expect(screen.getByText("Cache hit rate")).toBeOnTheScreen();
    expect(screen.getByText("claude-opus-4-5")).toBeOnTheScreen();
    expect(screen.getByText("Outside projects")).toBeOnTheScreen();
    expect(screen.getByText("When sessions start")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("90 days"));
    expect(state.range.select).toHaveBeenCalledWith("90");

    await fireEvent.press(screen.getByTestId("projects-electron-hello"));
    expect(state.openProject).toHaveBeenCalledWith("electron-hello");
    expect(screen.queryByTestId("projects-outside")).toBeNull();

    await fireEvent.press(screen.getByTestId("session-s-big"));
    expect(agentRun).toHaveBeenCalledWith("run_q1w2e3r4t5");
    await fireEvent.press(screen.getByTestId("session-s-terminal"));
    expect(terminal).toHaveBeenCalledWith("trm_1");
    expect(screen.getByText("Working")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(nav.back).toHaveBeenCalled();
  });

  it("inspects a day from the chart and shows it as a table", async () => {
    mockAnalytics.mockReturnValue(analytics());
    await render(<AnalyticsScreen />);

    const chart = screen.getByTestId("tokens-chart");
    expect(within(chart).getByText("Last 7 days")).toBeOnTheScreen();
    await fireEvent(within(chart).getByTestId("tokens-chart-plot").parent!, "layout", layout(344));
    await fireEvent(screen.getByTestId("tokens-chart-plot"), "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });
    expect(within(chart).getByText("Sep 24")).toBeOnTheScreen();
    expect(within(chart).getByText("2K")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Show Tokens over time as a table"));
    expect(screen.getByTestId("tokens-table")).toBeOnTheScreen();
    expect(screen.getByText("Cache write")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Show Tokens over time as a chart"));
    expect(screen.queryByTestId("tokens-table")).toBeNull();
  });

  it("shows skeletons while loading", async () => {
    mockAnalytics.mockReturnValue(analytics({ loading: true, view: null }));
    await render(<AnalyticsScreen />);
    expect(screen.getByTestId("analytics-skeleton")).toBeOnTheScreen();
    expect(screen.queryByTestId("analytics-overview")).toBeNull();
  });

  it("shows the empty state when there is no usage yet", async () => {
    const state = analytics({ empty: true, view: buildAnalyticsView({ days: 7, report: emptyWeekReport }) });
    mockAnalytics.mockReturnValue(state);
    await render(<AnalyticsScreen />);
    expect(screen.getByText("No usage yet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Start an agent run"));
    expect(nav.newAgentRun).toHaveBeenCalled();
  });

  it("renders a zero-usage report without crashing", async () => {
    mockAnalytics.mockReturnValue(analytics({ view: buildAnalyticsView({ days: 7, report: emptyWeekReport }) }));
    await render(<AnalyticsScreen />);
    await fireEvent(screen.getByTestId("tokens-chart-plot").parent!, "layout", layout(320));
    expect(screen.getByText("No model replies in this range.")).toBeOnTheScreen();
    expect(screen.getByText("No sessions were active in this range.")).toBeOnTheScreen();
    expect(screen.getByText("No activity")).toBeOnTheScreen();
  });

  it("reports errors with a retry", async () => {
    const state = analytics({ error: "Can't reach the sandbox.", view: null, sessionsError: null });
    mockAnalytics.mockReturnValue(state);
    await render(<AnalyticsScreen />);
    expect(screen.getByText("Usage didn't load")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(state.retry).toHaveBeenCalled();
  });

  it("reports a sessions error inside its section", async () => {
    const state = analytics({ sessionsError: "Sessions failed." });
    mockAnalytics.mockReturnValue(state);
    await render(<AnalyticsScreen />);
    expect(screen.getByText("Sessions failed.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(state.retrySessions).toHaveBeenCalled();
  });

  it("waits for the sandbox list", async () => {
    mockAnalytics.mockReturnValue(analytics({ sandbox: null }));
    await render(<AnalyticsScreen />);
    expect(screen.getByLabelText("Loading sandboxes…")).toBeOnTheScreen();
  });
});

describe("ProjectAnalyticsScreen", () => {
  it("drills into one project", async () => {
    mockParams = { id: "electron-hello", days: "30" };
    mockProject.mockReturnValue(project());
    await render(<ProjectAnalyticsScreen />);

    expect(mockProject).toHaveBeenCalledWith("electron-hello", "30");
    expect(screen.getByText("Electron Hello")).toBeOnTheScreen();
    expect(screen.getByText("Token mix")).toBeOnTheScreen();
    expect(within(screen.getByTestId("project-kpis-tokens")).getByText("9.5K")).toBeOnTheScreen();
    expect(within(screen.getByTestId("token-mix")).getByText("9.5K")).toBeOnTheScreen();
    expect(screen.getByTestId("session-s-big")).toBeOnTheScreen();
    expect(screen.queryByTestId("session-s-terminal")).toBeNull();
    await fireEvent.press(screen.getByTestId("session-s-big"));
    expect(agentRun).toHaveBeenCalledWith("run_q1w2e3r4t5");
  });

  it("says when the project has no usage in the range", async () => {
    mockParams = { id: "quiet" };
    mockProject.mockReturnValue(project({ title: "quiet", view: buildProjectView("quiet", weekReport, []) }));
    await render(<ProjectAnalyticsScreen />);
    expect(screen.getByText("No usage in this range")).toBeOnTheScreen();
  });

  it("shows skeletons while loading", async () => {
    mockParams = { id: "electron-hello" };
    mockProject.mockReturnValue(project({ loading: true, view: null }));
    await render(<ProjectAnalyticsScreen />);
    expect(screen.getByTestId("analytics-skeleton")).toBeOnTheScreen();
  });
});
