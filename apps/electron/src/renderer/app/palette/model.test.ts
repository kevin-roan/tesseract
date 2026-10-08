import { describe, expect, it } from "vitest";
import { highlightSegments, matchText, scoreCommand, searchCommands } from "./model";
import type { PaletteCommand } from "./types";

const command = (id: string, title: string, group: string, extra: Partial<PaletteCommand> = {}): PaletteCommand => ({
  id,
  title,
  group,
  run: () => undefined,
  ...extra,
});

const COMMANDS = [
  command("page:overview", "Go to Overview", "Navigation"),
  command("page:projects", "Go to Projects", "Navigation"),
  command("action:new", "New conversation", "Actions", { keywords: ["claude", "chat"] }),
  command("action:refresh", "Refresh connection", "Actions"),
  command("project:tesseract", "Open tesseract", "Projects", { subtitle: "expo" }),
  command("window:quit", "Quit Tesseract", "Window"),
];

const ORDER = ["Recent", "Navigation", "Projects", "Actions", "Window"];

describe("matchText", () => {
  it("ranks exact, prefix, word prefix, substring and fuzzy matches", () => {
    const scores = ["refresh connection", "refresh", "conn", "nnec", "rfc"].map((query) => matchText("Refresh connection", query)?.score ?? 0);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(matchText("Refresh connection", "xyz")).toBeNull();
    expect(matchText("Refresh connection", "set")).toBeNull();
  });

  it("returns highlight ranges for word and fuzzy matches", () => {
    expect(matchText("Go to Projects", "proj")?.ranges).toEqual([[6, 10]]);
    expect(matchText("New conversation", "nc")?.ranges).toEqual([[0, 1], [4, 5]]);
  });
});

describe("scoreCommand", () => {
  it("matches multiple terms, keywords and subtitles", () => {
    expect(scoreCommand(COMMANDS[3]!, "conn ref")?.ranges).toEqual([[0, 3], [8, 12]]);
    expect(scoreCommand(COMMANDS[2]!, "claude")).not.toBeNull();
    expect(scoreCommand(COMMANDS[4]!, "expo")).not.toBeNull();
    expect(scoreCommand(COMMANDS[0]!, "zzz")).toBeNull();
  });
});

describe("searchCommands", () => {
  it("groups everything in group order with recent commands first", () => {
    const sections = searchCommands(COMMANDS, "", { recent: ["window:quit", "missing"], recentGroup: "Recent", groupOrder: ORDER });
    expect(sections.map((section) => section.group)).toEqual(["Recent", "Navigation", "Projects", "Actions"]);
    expect(sections[0]!.results.map((result) => result.command.id)).toEqual(["window:quit"]);
  });

  it("orders groups by their best match when searching", () => {
    const sections = searchCommands(COMMANDS, "tesseract", { groupOrder: ORDER });
    expect(sections.map((section) => section.group)).toEqual(["Projects", "Window"]);
    expect(searchCommands(COMMANDS, "nothing-matches")).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("splits text into matched and plain runs", () => {
    expect(highlightSegments("Go to Projects", [[6, 10]])).toEqual([
      { text: "Go to ", match: false },
      { text: "Proj", match: true },
      { text: "ects", match: false },
    ]);
  });
});
