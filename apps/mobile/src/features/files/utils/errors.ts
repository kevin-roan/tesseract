import { isApiError } from "@theone/client";

import { describeError } from "@/features/sandbox/utils/errors";

import { MISSING_FILE_MESSAGE } from "./constants";

export class MissingFileError extends Error {
  constructor() {
    super(MISSING_FILE_MESSAGE);
    this.name = "MissingFileError";
  }
}

export function describeFileError(error: unknown): string {
  if (error instanceof MissingFileError || isApiError(error, "not_found")) return MISSING_FILE_MESSAGE;
  return describeError(error);
}
