import { useCallback } from "react";
import type { Appearance } from "../../../../shared/runtime";
import { useSettings, useUpdateSettings } from "../../../app/settings";

export function useAppearance() {
  const { appearance } = useSettings();
  const update = useUpdateSettings();
  const select = useCallback(
    (next: Appearance) => {
      if (next !== appearance) update.mutate({ appearance: next });
    },
    [appearance, update],
  );
  return { value: update.isPending && update.variables?.appearance ? update.variables.appearance : appearance, select };
}
