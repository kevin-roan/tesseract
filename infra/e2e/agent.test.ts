import { describe, expect, test } from "bun:test";
import { isFinalAgentRunState, type AgentRun, type AgentRunEvent } from "@theone/protocol";
import { client, SECONDS } from "./lib/env";

const RUN_DEADLINE_MS = 90 * SECONDS;

describe("headless Claude runs", () => {
  test(
    "a run ends instead of hanging (fails cleanly without credentials)",
    async () => {
      const started = await client.startAgentRun({ prompt: "Reply with the single word: pong" });
      expect(started.state).toBe("running");
      const events: AgentRunEvent[] = [];
      const final = await new Promise<AgentRun>((resolve, reject) => {
        const timer = setTimeout(() => {
          connection.close();
          reject(new Error(`run ${started.id} did not finish within ${RUN_DEADLINE_MS} ms`));
        }, RUN_DEADLINE_MS);
        const connection = client.openAgentRun(started.id, {
          onEvent: (event) => events.push(event),
          onRun: (run) => {
            if (!isFinalAgentRunState(run.state)) return;
            clearTimeout(timer);
            connection.close();
            resolve(run);
          },
        });
      });
      console.log(
        `agent run ${final.id}: ${final.state}; error=${JSON.stringify(final.error)}; result=${JSON.stringify(final.result)}; events=${events.length}`,
      );
      expect(["failed", "succeeded"]).toContain(final.state);
      expect(final.endedAt).not.toBeNull();
      if (final.state === "failed") expect(final.error?.trim().length ?? 0).toBeGreaterThan(0);
      const detail = await client.getAgentRun(final.id);
      expect(detail.state).toBe(final.state);
    },
    RUN_DEADLINE_MS + 15 * SECONDS,
  );
});
