import { fireEvent, render, screen } from "@testing-library/react-native";
import { sampleAgentRun } from "@theone/protocol/fixtures";

import RunningTasks from "@/features/home/components/running-tasks";
import { runningTasks } from "@/features/home/utils/running";

const NOW = Date.parse(sampleAgentRun.startedAt) + 2 * 60_000;
const name = (projectId: string | null) => (projectId ? `name:${projectId}` : null);

describe("runningTasks", () => {
  const older = { ...sampleAgentRun, id: "run_older00001", prompt: "Older", startedAt: "2026-01-01T00:00:00.000Z" };
  const done = { ...sampleAgentRun, id: "run_done000001", state: "succeeded" as const, endedAt: sampleAgentRun.startedAt };

  it("keeps unfinished runs, newest first, up to the limit, and counts them all", () => {
    const { tasks, total } = runningTasks([older, done, sampleAgentRun], name, 1, NOW);
    expect(total).toBe(2);
    expect(tasks).toEqual([
      {
        id: sampleAgentRun.id,
        title: "Build the Windows installer",
        meta: expect.stringContaining("name:electron-hello"),
        badge: { label: "Running", tone: expect.any(String) },
      },
    ]);
  });

  it("is empty without runs", () => {
    expect(runningTasks(undefined, name)).toEqual({ tasks: [], total: 0 });
  });
});

describe("<RunningTasks />", () => {
  const task = { id: "run_1", title: "Fix the login screen", meta: "app · just now", badge: { label: "Running" } };

  it("renders nothing while no task runs", async () => {
    await render(<RunningTasks tasks={[]} total={0} onOpen={jest.fn()} onViewAll={jest.fn()} testID="running" />);
    expect(screen.queryByTestId("running")).toBeNull();
  });

  it("opens a task and leads to all of them", async () => {
    const onOpen = jest.fn();
    const onViewAll = jest.fn();
    await render(<RunningTasks tasks={[task]} total={3} onOpen={onOpen} onViewAll={onViewAll} testID="running" />);
    expect(screen.getByText("Running · 3")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Fix the login screen, Running" }));
    expect(onOpen).toHaveBeenCalledWith("run_1");
    fireEvent.press(screen.getByTestId("running-all"));
    expect(onViewAll).toHaveBeenCalled();
  });
});
