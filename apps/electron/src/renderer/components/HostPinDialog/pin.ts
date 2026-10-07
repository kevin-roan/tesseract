import { PIN_PATTERN } from "./constants";

export type PinProblem = "pin" | "repeat" | null;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function pinError(pin: string, repeat: string): PinProblem {
  if (!isValidPin(pin)) return "pin";
  if (pin !== repeat) return "repeat";
  return null;
}
