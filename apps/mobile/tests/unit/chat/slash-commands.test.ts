import type { ClaudeCommand } from "@tesseract/protocol";

import {
  COMMAND_SOURCE_TAGS,
  MAX_COMMAND_HINTS,
  commandInput,
  matchCommands,
  slashQuery,
  toCommandHint,
} from "@/features/chat/utils/slash-commands";

const command = (name: string, source: ClaudeCommand["source"] = "builtin"): ClaudeCommand => ({
  name,
  description: `${name} description`,
  kind: "command",
  source,
});

describe("slashQuery", () => {
  it("returns the partial name only while the draft is a bare /command", () => {
    expect(slashQuery("/")).toBe("");
    expect(slashQuery("/dep")).toBe("dep");
    expect(slashQuery("/frontend:rev")).toBe("frontend:rev");
    expect(slashQuery("/deploy ")).toBeNull();
    expect(slashQuery("/deploy now")).toBeNull();
    expect(slashQuery("/a\nb")).toBeNull();
    expect(slashQuery("deploy")).toBeNull();
    expect(slashQuery(" /deploy")).toBeNull();
    expect(slashQuery("")).toBeNull();
  });
});

describe("matchCommands", () => {
  const commands = [command("review"), command("deploy", "project"), command("debug"), command("Deploy-all", "user")];

  it("filters by case-insensitive prefix, shortest and alphabetical first", () => {
    expect(matchCommands(commands, "de").map((entry) => entry.name)).toEqual(["debug", "deploy", "Deploy-all"]);
    expect(matchCommands(commands, "DEP").map((entry) => entry.name)).toEqual(["deploy", "Deploy-all"]);
    expect(matchCommands(commands, "x")).toEqual([]);
  });

  it("lists everything for an empty query, capped and without duplicate names", () => {
    const many = Array.from({ length: 10 }, (_, index) => command(`cmd${index}`));
    expect(matchCommands(many, "")).toHaveLength(MAX_COMMAND_HINTS);
    expect(matchCommands(many, "", 2)).toHaveLength(2);
    expect(matchCommands([command("deploy", "project"), command("deploy", "user")], "")).toEqual([command("deploy", "project")]);
  });
});

describe("command hints", () => {
  it("builds the input text and the row content", () => {
    expect(commandInput("deploy")).toBe("/deploy ");
    expect(toCommandHint(command("deploy", "project"))).toEqual({
      name: "deploy",
      label: "/deploy",
      description: "deploy description",
      tag: COMMAND_SOURCE_TAGS.project,
    });
  });
});
