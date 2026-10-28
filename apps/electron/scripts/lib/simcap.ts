import type { BuildTarget } from "./targets.ts";

/** Swift helper that encodes the iOS Simulator framebuffer to H.264 (macOS only, built with swiftc on a Mac). */
export const SIMCAP_BINARY = "tesseract-simcap";
/** Relative to the repo root; every *.swift file in it is one compile unit (no Package.swift). */
export const SIMCAP_SOURCE_DIR = "apps/controller/native/simcap";
// Matches electron-builder.yml mac.minimumSystemVersion.
export const SIMCAP_MIN_MACOS = "12";
// CoreSimulator and SimulatorKit are dlopen'ed at runtime, so only public frameworks are linked.
export const SIMCAP_FRAMEWORKS = ["VideoToolbox", "CoreMedia", "CoreVideo", "IOSurface"] as const;

export function simcapTriple(target: BuildTarget): string {
  return `${target.arch === "arm64" ? "arm64" : "x86_64"}-apple-macos${SIMCAP_MIN_MACOS}`;
}

/** Arguments for `xcrun`, e.g. `xcrun --sdk macosx swiftc -O ... -o <outfile> <sources>`. */
export function simcapSwiftcArgs(target: BuildTarget, sources: readonly string[], outfile: string): string[] {
  return [
    "--sdk",
    "macosx",
    "swiftc",
    "-O",
    "-swift-version",
    "5",
    "-target",
    simcapTriple(target),
    ...SIMCAP_FRAMEWORKS.flatMap((framework) => ["-framework", framework]),
    "-o",
    outfile,
    ...sources,
  ];
}
