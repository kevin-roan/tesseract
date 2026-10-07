import { act, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/render";
import { LogView } from "./LogView";
import { appendLog, EMPTY_LOG_STATE } from "./model";
import { useLogBuffer } from "./use-log-buffer";

describe("LogView", () => {
  it("shows the empty label without lines", () => {
    renderWithProviders(<LogView lines={[]} emptyLabel="Waiting for output…" />);
    expect(screen.getByText("Waiting for output…")).toBeTruthy();
  });

  it("renders lines with kinds and ansi segments", () => {
    const { lines } = appendLog(EMPTY_LOG_STATE, [
      { text: "hello", stream: "stdout" },
      { text: "Error: boom", stream: "stderr" },
      { text: "\u001b[31mred\u001b[0m", stream: "stdout" },
    ]);
    const { container } = renderWithProviders(<LogView lines={lines} />);
    const rendered = [...container.querySelectorAll("[data-kind]")];
    expect(rendered.map((line) => line.getAttribute("data-kind"))).toEqual(["stdout", "error", "stdout"]);
    expect(rendered[2]?.querySelector("span")?.getAttribute("style")).toContain("--log-ansi-1");
    expect(screen.queryByText("No output yet.")).toBeNull();
  });
});

describe("useLogBuffer", () => {
  it("appends, sets and clears", () => {
    const { result } = renderHook(() => useLogBuffer(2));
    act(() => result.current.appendLines([{ text: "a", seq: 1 }, { text: "b", seq: 2 }, { text: "c", seq: 3 }]));
    expect(result.current.lines.map((line) => line.text)).toEqual(["b", "c"]);
    act(() => result.current.setLines([{ text: "x", seq: 1 }]));
    expect(result.current.lines.map((line) => line.text)).toEqual(["x"]);
    act(() => result.current.appendLine("err", "stderr"));
    expect(result.current.lines[1]?.kind).toBe("stderr");
    act(() => result.current.clear());
    expect(result.current.lines).toEqual([]);
  });
});
