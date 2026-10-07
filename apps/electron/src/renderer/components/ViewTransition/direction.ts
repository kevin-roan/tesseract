export type ViewDirection = "forward" | "back" | "none";

export function viewDirection(previousDepth: number, nextDepth: number): ViewDirection {
  if (nextDepth > previousDepth) return "forward";
  if (nextDepth < previousDepth) return "back";
  return "none";
}
