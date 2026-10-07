import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";

export interface NumberDraftOptions {
  value: number;
  min: number;
  max: number;
  step?: number;
  clamp(value: number): number;
  onCommit(value: number): void;
}

export interface NumberDraft {
  text: string;
  invalid: boolean;
  onChange(event: ChangeEvent<HTMLInputElement>): void;
  onBlur(): void;
  onKeyDown(event: KeyboardEvent<HTMLInputElement>): void;
  nudge(delta: number): void;
}

const DIGITS = /^\d*$/;

export function useNumberDraft({ value, min, max, step = 1, clamp, onCommit }: NumberDraftOptions): NumberDraft {
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [value]);

  const parsed = draft === null ? value : Number.parseInt(draft, 10);
  const invalid = draft !== null && (!Number.isFinite(parsed) || parsed < min || parsed > max);

  const commit = (next: number) => {
    setDraft(null);
    const clamped = clamp(next);
    if (clamped !== value) onCommit(clamped);
  };

  return {
    text: draft ?? String(value),
    invalid,
    onChange: (event) => {
      if (DIGITS.test(event.target.value)) setDraft(event.target.value);
    },
    onBlur: () => commit(Number.isFinite(parsed) ? parsed : value),
    onKeyDown: (event) => {
      const base = Number.isFinite(parsed) ? parsed : value;
      if (event.key === "ArrowUp") commit(base + step);
      else if (event.key === "ArrowDown") commit(base - step);
      else if (event.key === "Enter" && draft !== null) commit(base);
      else if (event.key === "Escape" && draft !== null) setDraft(null);
      else return;
      event.preventDefault();
    },
    nudge: (delta) => commit((Number.isFinite(parsed) ? parsed : value) + delta),
  };
}
