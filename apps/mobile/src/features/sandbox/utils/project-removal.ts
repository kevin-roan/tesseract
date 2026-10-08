import type { SyncChanges } from "@tesseract/protocol";

import type { ConfirmOptions } from "@/lib/confirm";

import { pluralize } from "./format";
import { syncPathsPreview } from "./sync";

export type ProjectRemovalPrompt = ConfirmOptions & { force: boolean };

export const PROJECT_REMOVAL_DETAIL = "Moves it to /tmp in the sandbox. The project on your computer is not touched.";

/** The confirmation before `DELETE /v1/projects/:id`: unsynced work needs a force delete. */
export function projectRemovalPrompt(title: string, sync: SyncChanges): ProjectRemovalPrompt {
  const host = sync.host?.name ?? "your computer";
  if (sync.baselineAt === null) {
    return {
      title: "Only copy of this project",
      message: `${title} was never synced from a computer, so the sandbox has its only copy. Deleting moves it to /tmp in the sandbox.`,
      confirmLabel: "Force delete",
      destructive: true,
      force: true,
    };
  }
  if (sync.changes.length > 0) {
    const paths = sync.changes.map((change) => change.path);
    return {
      title: "Unsynced changes",
      message: `${pluralize(paths.length, "file")} in ${title} changed in the sandbox and ${paths.length === 1 ? "is" : "are"} not synced back to ${host}: ${syncPathsPreview(paths)}.\n\nSync to host first to keep them there, or force delete: the sandbox copy moves to /tmp and the project on ${host} stays as it was.`,
      confirmLabel: "Force delete",
      destructive: true,
      force: true,
    };
  }
  return {
    title: `Delete ${title}?`,
    message: `It moves to /tmp in the sandbox. The project on ${host} is not touched.`,
    confirmLabel: "Delete",
    destructive: true,
    force: false,
  };
}
