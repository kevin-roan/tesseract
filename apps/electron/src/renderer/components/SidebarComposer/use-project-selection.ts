import { useEffect, useState } from "react";
import { type PickerProject, resolveSelection } from "./model";

export function useProjectSelection(projects: readonly PickerProject[], initial: string | null = null) {
  const [selected, setSelected] = useState<string | null>(initial);
  const resolved = resolveSelection(projects, selected);
  useEffect(() => {
    if (resolved !== selected) setSelected(resolved);
  }, [resolved, selected]);
  return [resolved, setSelected] as const;
}
