export interface BuildTarget {
  id: string;
  bunTarget: string;
  builderOs: "linux" | "mac" | "win";
  arch: "x64" | "arm64";
  exe: string;
}

export const BUILD_TARGETS: readonly BuildTarget[] = [
  { id: "linux-x64", bunTarget: "bun-linux-x64", builderOs: "linux", arch: "x64", exe: "" },
  { id: "linux-arm64", bunTarget: "bun-linux-arm64", builderOs: "linux", arch: "arm64", exe: "" },
  { id: "mac-x64", bunTarget: "bun-darwin-x64", builderOs: "mac", arch: "x64", exe: "" },
  { id: "mac-arm64", bunTarget: "bun-darwin-arm64", builderOs: "mac", arch: "arm64", exe: "" },
  { id: "win-x64", bunTarget: "bun-windows-x64", builderOs: "win", arch: "x64", exe: ".exe" },
];

export function hostTargetId(): string {
  const os = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux";
  return `${os}-${process.arch === "arm64" ? "arm64" : "x64"}`;
}

export function findTarget(id: string): BuildTarget {
  const target = BUILD_TARGETS.find((candidate) => candidate.id === id);
  if (!target) throw new Error(`Unknown target ${id}; expected one of ${BUILD_TARGETS.map((item) => item.id).join(", ")}`);
  return target;
}
