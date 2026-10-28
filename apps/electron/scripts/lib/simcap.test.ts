import { describe, expect, it } from "vitest";
import { simcapSwiftcArgs, simcapTriple } from "./simcap.ts";
import { findTarget } from "./targets.ts";

describe("simcap build", () => {
  it("maps each mac target to its swiftc triple", () => {
    expect(simcapTriple(findTarget("mac-arm64"))).toBe("arm64-apple-macos12");
    expect(simcapTriple(findTarget("mac-x64"))).toBe("x86_64-apple-macos12");
  });

  it("links only public frameworks and writes the requested outfile", () => {
    const args = simcapSwiftcArgs(findTarget("mac-x64"), ["/src/main.swift"], "/out/tesseract-simcap");
    expect(args.slice(0, 3)).toEqual(["--sdk", "macosx", "swiftc"]);
    expect(args).toContain("x86_64-apple-macos12");
    expect(args.join(" ")).toContain("-framework VideoToolbox -framework CoreMedia -framework CoreVideo -framework IOSurface");
    expect(args.join(" ")).not.toMatch(/CoreSimulator|SimulatorKit/);
    expect(args.slice(-3)).toEqual(["-o", "/out/tesseract-simcap", "/src/main.swift"]);
  });
});
