/** Moves `value` by `delta` within [min, max], rounded to the step's decimals so 0.1 + 0.2 stays 0.3. */
export function stepValue(value: number, delta: number, min: number, max: number): number {
  const decimals = (String(Math.abs(delta)).split(".")[1] ?? "").length;
  const next = Number((value + delta).toFixed(decimals));
  return Math.min(max, Math.max(min, next));
}
