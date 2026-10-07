import type { DisplayMode } from "../../features/display/types";

export type DisplayView = "empty" | "preview" | "viewer";

export function viewFor(mode: DisplayMode): DisplayView {
  if (mode === "viewer") return "viewer";
  if (mode === "preview") return "preview";
  return "empty";
}
