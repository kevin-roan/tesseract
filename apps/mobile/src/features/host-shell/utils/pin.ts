import { HOST_PIN_PATTERN } from "@tesseract/protocol";

import type { PinAction, PinState } from "../types";
import { PIN_MAX_LENGTH } from "./constants";

export const EMPTY_PIN: PinState = { digits: "", error: false };

export function pinReducer(state: PinState, action: PinAction): PinState {
  switch (action.type) {
    case "digit":
      if (!/^\d$/.test(action.digit) || state.digits.length >= PIN_MAX_LENGTH) return state;
      return { digits: state.digits + action.digit, error: false };
    case "delete":
      return { digits: state.digits.slice(0, -1), error: false };
    case "clear":
      return EMPTY_PIN;
    case "reject":
      return { digits: "", error: true };
  }
}

export function isCompletePin(digits: string): boolean {
  return HOST_PIN_PATTERN.test(digits);
}
