import { useCallback, useMemo } from "react";
import { useRovingChoice } from "../SegmentedControl/use-roving-choice";
import type { ChipOption } from "./types";

export function useChipGroup<T extends string>(options: readonly ChipOption<T>[], value: T | null, onChange?: (id: T) => void) {
  const ids = useMemo(() => options.filter((option) => !option.disabled).map((option) => option.id), [options]);
  const select = useCallback(
    (id: T) => {
      if (id !== value) onChange?.(id);
    },
    [onChange, value],
  );
  const onKeyDown = useRovingChoice(ids, value, select);
  const focusId = value !== null && ids.includes(value) ? value : (ids[0] ?? null);
  return { select, onKeyDown, focusId };
}
