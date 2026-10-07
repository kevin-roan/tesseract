import { CONFLICT_PREVIEW } from "./constants";
import { DIFF_LABELS, SYNC_LABELS } from "./labels";

export class SyncBackError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SyncBackError";
  }
}

export class NotLinked extends SyncBackError {
  readonly projectId: string;

  constructor(projectId: string) {
    super(SYNC_LABELS.notLinked(projectId));
    this.name = "NotLinked";
    this.projectId = projectId;
  }
}

export type ConflictAction = "pull" | "revert";

export class SyncConflict extends SyncBackError {
  readonly conflicts: string[];

  constructor(conflicts: string[], action: ConflictAction = "pull") {
    const preview = conflicts.slice(0, CONFLICT_PREVIEW).join(", ");
    super(
      action === "pull"
        ? SYNC_LABELS.conflictPull(conflicts.length, preview)
        : SYNC_LABELS.conflictRevert(conflicts.length, preview),
    );
    this.name = "SyncConflict";
    this.conflicts = conflicts;
  }
}

export class TooLarge extends Error {
  readonly size: number;

  constructor(size: number) {
    super(DIFF_LABELS.tooLarge(size));
    this.name = "TooLarge";
    this.size = size;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

export function errnoCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : undefined;
}

export function isMissing(error: unknown): boolean {
  return errnoCode(error) === "ENOENT";
}
