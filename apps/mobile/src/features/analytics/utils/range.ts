import type { ChoiceOption } from "@/components/choice-group";

import type { RangeDays } from "../types";

export const RANGES: readonly RangeDays[] = [7, 30, 90];
export const DEFAULT_RANGE: RangeDays = 30;

export const RANGE_OPTIONS: ChoiceOption[] = RANGES.map((days) => ({ id: String(days), label: `${days} days` }));

export function parseRange(value: string | string[] | undefined | null): RangeDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const days = Number(raw);
  return RANGES.find((range) => range === days) ?? DEFAULT_RANGE;
}
