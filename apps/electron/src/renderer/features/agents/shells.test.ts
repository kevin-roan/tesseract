import type { AgentShell } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { shellLogLines, visibleShells } from "./shells";

const shell = (id: string, running: boolean): AgentShell => ({ id, command: `cmd ${id}`, running });

describe("visibleShells", () => {
  it("keeps running shells and the one whose log is open", () => {
    const shells = [shell("a", true), shell("b", false), shell("c", false)];
    expect(visibleShells(shells, "c").map(({ id }) => id)).toEqual(["a", "c"]);
    expect(visibleShells(shells, null).map(({ id }) => id)).toEqual(["a"]);
  });
});

describe("shellLogLines", () => {
  it("splits output into lines without a trailing blank", () => {
    expect(shellLogLines("one\r\ntwo\n").map(({ text }) => text)).toEqual(["one", "two"]);
  });

  it("is empty for no output", () => {
    expect(shellLogLines("")).toEqual([]);
  });
});
