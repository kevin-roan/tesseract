import { PROJECT_ID_PATTERN } from "../constants";

export function isPlainProjectId(value: unknown): value is string {
  return typeof value === "string" && PROJECT_ID_PATTERN.test(value) && value !== "." && value !== "..";
}
