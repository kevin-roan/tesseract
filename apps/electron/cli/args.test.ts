import { describe, expect, it } from "vitest";
import { firstSubcommand, parseArgs, positiveInt, splitList } from "./args";

describe("parseArgs", () => {
  it("separates flags, values and positionals", () => {
    const parsed = parseArgs(["sandbox", "logs", "--tail", "50", "--follow", "--with=android,whisper", "extra"], ["tail", "with"]);
    expect([...parsed.flags]).toEqual(["follow"]);
    expect(Object.fromEntries(parsed.values)).toEqual({ tail: "50", with: "android,whisper" });
    expect(parsed.positional).toEqual(["sandbox", "logs", "extra"]);
  });

  it("expands short flags and stops at --", () => {
    const parsed = parseArgs(["logs", "-fh", "--", "--not-a-flag"], []);
    expect([...parsed.flags].sort()).toEqual(["follow", "help"]);
    expect(parsed.positional).toEqual(["logs", "--not-a-flag"]);
  });

  it("finds the first subcommand", () => {
    expect(firstSubcommand(["--json", "status"])).toBe("status");
    expect(firstSubcommand(["--sync", "--confidential"])).toBeNull();
  });
});

describe("value helpers", () => {
  it("splits comma lists", () => {
    expect(splitList(" Android, whisper ,,")).toEqual(["android", "whisper"]);
  });

  it("parses positive integers only", () => {
    expect(positiveInt("12")).toBe(12);
    expect(positiveInt("0")).toBeNull();
    expect(positiveInt("-3")).toBeNull();
    expect(positiveInt("1.5")).toBeNull();
    expect(positiveInt(undefined)).toBeNull();
  });
});
