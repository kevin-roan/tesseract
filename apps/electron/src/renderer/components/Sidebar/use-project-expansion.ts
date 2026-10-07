import { useCallback, useState } from "react";
import {
  EMPTY_EXPANSION,
  isExpanded,
  toggleExpansion,
  withActiveProjects,
  type ExpansionState,
  type SidebarProjectItem,
} from "./model";

export interface ProjectExpansion {
  isExpanded(id: string | null): boolean;
  toggle(id: string | null): void;
}

export function useProjectExpansion(items: readonly Pick<SidebarProjectItem, "id" | "running">[]): ProjectExpansion {
  const [state, setState] = useState<ExpansionState>(() => withActiveProjects(EMPTY_EXPANSION, items));
  const next = withActiveProjects(state, items);
  if (next !== state) setState(next);
  const toggle = useCallback((id: string | null) => setState((current) => toggleExpansion(current, id)), []);
  return { isExpanded: (id) => isExpanded(next, id), toggle };
}
