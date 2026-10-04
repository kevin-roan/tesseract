export type PinKey = { kind: "digit"; digit: string } | { kind: "delete" } | { kind: "submit" };

const digit = (value: string): PinKey => ({ kind: "digit", digit: value });

export const PIN_KEYS: PinKey[][] = [
  [digit("1"), digit("2"), digit("3")],
  [digit("4"), digit("5"), digit("6")],
  [digit("7"), digit("8"), digit("9")],
  [{ kind: "delete" }, digit("0"), { kind: "submit" }],
];

export const pinKeyId = (key: PinKey): string => (key.kind === "digit" ? key.digit : key.kind);

export function pinKeyLabel(key: PinKey, submitLabel: string): string {
  if (key.kind === "digit") return key.digit;
  return key.kind === "delete" ? "Delete" : submitLabel;
}

export const pinDotCount = (entered: number, minLength: number): number => Math.max(entered, minLength);
