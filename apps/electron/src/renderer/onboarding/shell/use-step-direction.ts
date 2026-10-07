import { useState } from "react";
import { directionBetween, type StepDirection } from "./model";

export function useStepDirection(index: number): StepDirection {
  const [seen, setSeen] = useState<{ index: number; direction: StepDirection }>({ index, direction: 1 });
  if (seen.index === index) return seen.direction;
  const direction = directionBetween(seen.index, index, seen.direction);
  setSeen({ index, direction });
  return direction;
}
