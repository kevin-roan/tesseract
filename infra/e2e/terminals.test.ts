import { afterAll, describe, expect, test } from "bun:test";
import type { TerminalConnection } from "@tesseract/client";
import type { TerminalInfo } from "@tesseract/protocol";
import { client, SECONDS } from "./lib/env";
import { processesMatching } from "./lib/sandbox";
import { delay, waitFor } from "./lib/wait";

interface Attached {
  connection: TerminalConnection;
  output: () => string;
  outputs: string[];
  exitCode: () => number | null | undefined;
}

function attach(id: string): Attached {
  const outputs: string[] = [];
  let exit: number | null | undefined;
  const connection = client.openTerminal(id, {
    onOutput: (data) => outputs.push(data),
    onExit: (code) => {
      exit = code;
    },
  });
  return { connection, outputs, output: () => outputs.join(""), exitCode: () => exit };
}

const created: TerminalInfo[] = [];

afterAll(async () => {
  for (const terminal of created) await client.closeTerminal(terminal.id).catch(() => undefined);
});

describe("terminals", () => {
  test(
    "shell PTY round trip, resize and scrollback replay",
    async () => {
      const terminal = await client.createTerminal({ kind: "shell", cols: 80, rows: 24 });
      created.push(terminal);
      expect(terminal.state).toBe("running");
      expect(terminal.pid).toBeGreaterThan(0);

      const first = attach(terminal.id);
      await waitFor("terminal socket", () => first.connection.state === "open", 15 * SECONDS);
      expect(first.connection.send("echo tesseract-$((6*7))\r")).toBe(true);
      await waitFor("tesseract-42 in the output", () => first.output().includes("tesseract-42"), 20 * SECONDS);

      expect(first.connection.resize(100, 30)).toBe(true);
      await delay(300);
      first.connection.send("stty size\r");
      await waitFor("the new size", () => first.output().includes("30 100"), 20 * SECONDS);
      const listed = await waitFor("resized terminal row", async () => {
        const row = (await client.listTerminals()).find((item) => item.id === terminal.id);
        return row && row.cols === 100 && row.rows === 30 ? row : undefined;
      });
      expect(listed.state).toBe("running");
      first.connection.close();

      const second = attach(terminal.id);
      await waitFor("scrollback replay", () => second.outputs.length > 0, 15 * SECONDS);
      expect(second.outputs[0]).toContain("tesseract-42");
      second.connection.send("exit\r");
      await waitFor("shell exit", () => second.exitCode() !== undefined, 20 * SECONDS);
      expect(second.exitCode()).toBe(0);
      const ended = await waitFor("exited terminal row", async () => {
        const row = (await client.listTerminals()).find((item) => item.id === terminal.id);
        return row?.state === "exited" ? row : undefined;
      });
      expect(ended.exitCode).toBe(0);
      second.connection.close();
    },
    90 * SECONDS,
  );

  test(
    "a claude terminal starts and can be closed",
    async () => {
      const terminal = await client.createTerminal({ kind: "claude", cols: 100, rows: 30 });
      created.push(terminal);
      expect(terminal.kind).toBe("claude");
      expect(terminal.state).toBe("running");
      expect(terminal.pid).toBeGreaterThan(0);

      const session = attach(terminal.id);
      await waitFor("claude output", () => session.output().length > 0, 30 * SECONDS);
      expect(session.output()).not.toMatch(/command not found|No such file/);
      expect((await processesMatching("bin/claude")).length).toBeGreaterThan(0);

      const closed = await client.closeTerminal(terminal.id);
      expect(closed).toMatchObject({ id: terminal.id, state: "exited" });
      expect((await client.listTerminals()).some((item) => item.id === terminal.id)).toBe(false);
      await waitFor("claude to be gone", async () => (await processesMatching("bin/claude")).length === 0, 15 * SECONDS);
      session.connection.close();
    },
    90 * SECONDS,
  );
});
