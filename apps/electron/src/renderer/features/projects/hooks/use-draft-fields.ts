import { useCallback, useRef, useState, type ChangeEvent } from "react";

export interface DraftField {
  value: string;
  error: boolean;
  onChange(event: ChangeEvent<HTMLInputElement>): void;
  ref(element: HTMLInputElement | null): void;
}

export function useDraftFields<K extends string>(initial: Record<K, string>) {
  const initialRef = useRef(initial);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
  const elements = useRef<Partial<Record<K, HTMLInputElement | null>>>({});

  const setValue = useCallback((key: K, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const field = (key: K): DraftField => ({
    value: values[key],
    error: Boolean(errors[key]),
    onChange: (event) => setValue(key, event.target.value),
    ref: (element) => {
      elements.current[key] = element;
    },
  });

  const fail = useCallback((next: Partial<Record<K, string>>) => {
    setErrors(next);
    const first = (Object.keys(initialRef.current) as K[]).find((key) => next[key]);
    if (first) elements.current[first]?.focus();
  }, []);

  const errorsFor = (...keys: K[]) => keys.map((key) => errors[key]).filter((message): message is string => Boolean(message));

  const reset = useCallback((next?: Record<K, string>) => {
    if (next) initialRef.current = next;
    setValues(initialRef.current);
    setErrors({});
  }, []);

  const focus = useCallback((key: K) => elements.current[key]?.focus(), []);

  return { values, errors, field, setValue, fail, errorsFor, reset, focus };
}
