import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { SEARCH_DEBOUNCE_MS } from "./constants";

export interface SearchFieldOptions {
  value: string;
  onChange(value: string): void;
  onSearch?(value: string): void;
  onStop?(): void;
  debounceMs?: number;
}

export function useSearchField({ value, onChange, onSearch, onStop, debounceMs = SEARCH_DEBOUNCE_MS }: SearchFieldOptions) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef(onSearch);
  searchRef.current = onSearch;

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const schedule = useCallback(
    (next: string) => {
      cancel();
      if (!searchRef.current) return;
      if (next === "" || debounceMs <= 0) {
        searchRef.current(next);
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        searchRef.current?.(next);
      }, debounceMs);
    },
    [cancel, debounceMs],
  );

  const change = useCallback(
    (next: string) => {
      onChange(next);
      schedule(next);
    },
    [onChange, schedule],
  );

  const clear = useCallback(() => change(""), [change]);

  const submit = useCallback(() => {
    cancel();
    searchRef.current?.(value);
  }, [cancel, value]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (value) clear();
      else onStop?.();
    },
    [clear, onStop, value],
  );

  return { change, clear, submit, onKeyDown, hasValue: value.length > 0 };
}
