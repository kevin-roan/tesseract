import { MAX_COMMAND_LENGTH, MAX_NAME_LENGTH, PROJECTS_ROOT } from "./constants";
import { VALIDATION_LABELS } from "./labels";
import type { ProcessDraftError, ProjectDraftError } from "./types";

export function projectErrorMessage(error: ProjectDraftError, projectId: string | null): string {
  switch (error) {
    case "name_required":
      return VALIDATION_LABELS.nameRequired;
    case "name_too_long":
      return VALIDATION_LABELS.nameTooLong(MAX_NAME_LENGTH);
    case "name_invalid":
      return VALIDATION_LABELS.nameInvalid;
    case "name_exists":
      return VALIDATION_LABELS.nameExists(PROJECTS_ROOT, projectId ?? "");
    case "git_url":
      return VALIDATION_LABELS.gitUrl;
    case "branch_needs_url":
      return VALIDATION_LABELS.branchNeedsUrl;
    case "branch_invalid":
      return VALIDATION_LABELS.branchInvalid;
  }
}

export function processErrorMessage(error: ProcessDraftError): string {
  switch (error) {
    case "command_required":
      return VALIDATION_LABELS.commandRequired;
    case "command_too_long":
      return VALIDATION_LABELS.commandTooLong(MAX_COMMAND_LENGTH);
    case "name_too_long":
      return VALIDATION_LABELS.nameTooLong(MAX_NAME_LENGTH);
    case "port_invalid":
      return VALIDATION_LABELS.portInvalid;
  }
}

export function mapErrors<K extends string, E extends string>(errors: Partial<Record<K, E>>, describe: (error: E) => string): Partial<Record<K, string>> {
  const result: Partial<Record<K, string>> = {};
  for (const key of Object.keys(errors) as K[]) {
    const error = errors[key];
    if (error) result[key] = describe(error);
  }
  return result;
}
