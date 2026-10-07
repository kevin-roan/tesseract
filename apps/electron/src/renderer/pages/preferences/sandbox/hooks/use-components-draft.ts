import { useState } from "react";
import type { SandboxComponent } from "../../../../../shared/contracts/sandbox";
import { sameComponents, toggleComponent } from "../model";

export function useComponentsDraft(saved: readonly SandboxComponent[] | null) {
  const [draft, setDraft] = useState<SandboxComponent[] | null>(null);
  const current = draft ?? (saved ? [...saved] : []);
  const dirty = draft !== null && saved !== null && !sameComponents(draft, saved);
  return {
    components: current,
    dirty,
    toggle: (component: SandboxComponent, on: boolean) => setDraft(toggleComponent(current, component, on)),
    reset: () => setDraft(null),
  };
}
