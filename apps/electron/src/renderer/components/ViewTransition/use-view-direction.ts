import { useState } from "react";
import { viewDirection, type ViewDirection } from "./direction";

interface ViewDirectionState {
  key: string;
  depth: number;
  direction: ViewDirection;
}

export function useViewDirection(key: string, depth: number): ViewDirection {
  const [state, setState] = useState<ViewDirectionState>({ key, depth, direction: "none" });
  if (state.key === key) return state.direction;
  const next: ViewDirectionState = { key, depth, direction: viewDirection(state.depth, depth) };
  setState(next);
  return next.direction;
}
