import { describe, expect, it } from "vitest";
import { ICON_SHAPES, icoArgs, masterArgs } from "./icons.ts";

describe("icon commands", () => {
  it("masks the artwork into a centered rounded square on a 1024 canvas", () => {
    const args = masterArgs("src.png", ICON_SHAPES.mac, "out.png");
    expect(args[0]).toBe("src.png");
    expect(args).toContain("824x824!");
    expect(args).toContain("roundrectangle 0,0 823,823 185,185");
    expect(args.slice(-3)).toEqual(["1024x1024", "-strip", "out.png"]);
  });

  it("packs every Windows size into the .ico", () => {
    expect(icoArgs("icon.png", "icon.ico")).toContain("icon:auto-resize=16,24,32,48,64,128,256");
  });
});
