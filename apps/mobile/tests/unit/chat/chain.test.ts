import type { AgentRun } from "@tesseract/protocol";
import { sampleAgentRun } from "@tesseract/protocol/fixtures";

import { earlierTurns, latestTurnOf, latestTurns, parentRun } from "@/features/chat/utils/messages";

const at = (minute: number) => `2026-10-08T10:${String(minute).padStart(2, "0")}:00.000Z`;
const run = (id: string, minute: number, sessionId: string | null, resumedSessionId: string | null = null): AgentRun => ({
  ...sampleAgentRun,
  id,
  startedAt: at(minute),
  sessionId,
  resumedSessionId,
});

const root = run("run_a", 0, "s1");
const second = run("run_b", 5, "s2", "s1");
const third = run("run_c", 9, "s3", "s2");
const other = run("run_x", 3, "s9");
const runs = [third, other, root, second];

describe("run chains", () => {
  it("links a follow-up to the run whose session it resumed", () => {
    expect(parentRun(runs, third)?.id).toBe("run_b");
    expect(parentRun(runs, root)).toBeNull();
  });

  it("falls back to the shared session id for runs without a resume link", () => {
    const legacy = [run("run_1", 0, "s"), run("run_2", 4, "s")];
    expect(parentRun(legacy, legacy[1]!)?.id).toBe("run_1");
  });

  it("stacks every earlier turn oldest first", () => {
    expect(earlierTurns(runs, third).map((turn) => turn.id)).toEqual(["run_a", "run_b"]);
    expect(earlierTurns(undefined, third)).toEqual([]);
  });

  it("finds the newest turn of a chat from any of its runs", () => {
    expect(latestTurnOf(runs, root).id).toBe("run_c");
    expect(latestTurnOf(runs, other).id).toBe("run_x");
  });

  it("lists each chat once", () => {
    expect(latestTurns(runs).map((item) => item.id)).toEqual(["run_c", "run_x"]);
  });
});
