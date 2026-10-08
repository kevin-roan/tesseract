import type { IslandAction, IslandActionKind } from "@/modules/tesseract-island";

const ACTION_KINDS: readonly IslandActionKind[] = ["stop", "capture", "open", "share"];

export function isIslandActionKind(value: string | undefined): value is IslandActionKind {
  return value !== undefined && (ACTION_KINDS as readonly string[]).includes(value);
}

/** `tesseract://island/<action>` and `tesseract://island/run/<id>` become the same actions the native side emits. */
export function actionFromRoute(action: string | undefined, runId?: string | undefined): IslandAction | null {
  if (action === "run") return runId ? { action: "open", runId } : { action: "open" };
  if (!isIslandActionKind(action) || action === "stop") return null;
  return { action };
}
