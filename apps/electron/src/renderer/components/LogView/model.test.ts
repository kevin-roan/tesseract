import { describe, expect, it } from "vitest";
import { appendLog, cleanLogText, EMPTY_LOG_STATE, logLineKind, parseAnsi } from "./model";

describe("log model", () => {
  it("cleans escapes, trailing newlines and carriage-return progress", () => {
    expect(cleanLogText("\u001b[32mok\u001b[0m\r\n")).toBe("ok");
    expect(cleanLogText("10%\r50%\r100%")).toBe("100%");
    expect(cleanLogText("\u001b]0;title\u0007text")).toBe("text");
  });

  it("classifies stderr errors only", () => {
    expect(logLineKind("stderr", "Error: boom")).toBe("error");
    expect(logLineKind("stderr", "TypeError: x")).toBe("error");
    expect(logLineKind("stderr", "a.ts(1,2): error TS2322: nope")).toBe("error");
    expect(logLineKind("stderr", "warning: slow")).toBe("stderr");
    expect(logLineKind("stdout", "Error: boom")).toBe("stdout");
    expect(logLineKind("weird", "x")).toBe("stdout");
    expect(logLineKind("system", "x")).toBe("system");
  });

  it("dedupes by seq and trims to maxLines", () => {
    let state = appendLog(EMPTY_LOG_STATE, [
      { text: "a", seq: 1 },
      { text: "b", seq: 2 },
    ]);
    state = appendLog(state, [{ text: "dup", seq: 2 }, { text: "c", seq: 3 }, "no-seq"], 3);
    expect(state.lines.map((line) => line.text)).toEqual(["b", "c", "no-seq"]);
    expect(state.lastSeq).toBe(3);
    expect(state.lines.map((line) => line.id)).toEqual([1, 2, 3]);
  });

  it("keeps the same state when nothing is added", () => {
    const state = appendLog(EMPTY_LOG_STATE, [{ text: "a", seq: 1 }]);
    expect(appendLog(state, [{ text: "a", seq: 1 }])).toBe(state);
  });

  it("parses SGR colors into segments", () => {
    expect(parseAnsi("plain")).toBeNull();
    expect(parseAnsi("\u001b[1;31mred\u001b[39m bold\u001b[0m end")).toEqual([
      { text: "red", fg: 1, bold: true },
      { text: " bold", bold: true },
      { text: " end" },
    ]);
    expect(parseAnsi("\u001b[38;2;255;0;16mx")).toEqual([{ text: "x", fg: "#ff0010" }]);
    expect(parseAnsi("\u001b[94mhi\u001b[2K")).toEqual([{ text: "hi", fg: 12 }]);
  });
});
