import type { TextVariant } from "../Text/variants";

export const LIST_INDENT_PX = 18;

export const HEADING_VARIANTS: Record<number, TextVariant> = { 1: "h3", 2: "h4" };
export const HEADING_FALLBACK_VARIANT: TextVariant = "bodyStrong";
export const TABLE_HEADER_VARIANT: TextVariant = "bodyStrong";

export const TASK_MARKERS = { checked: "☑", unchecked: "☐" } as const;
