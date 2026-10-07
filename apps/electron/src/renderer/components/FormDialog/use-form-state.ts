import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export interface FieldBinding {
  value: string;
  error: boolean;
  onChange(event: ChangeEvent<HTMLInputElement>): void;
  ref(element: HTMLInputElement | null): void;
}

export interface FormState<K extends string> {
  values: Record<K, string>;
  errors: FieldErrors<K>;
  field(key: K): FieldBinding;
  fail(errors: FieldErrors<K>): void;
  errorsFor(...keys: K[]): string[];
  reset(): void;
}

export function useFormState<K extends string>(initial: Record<K, string>): FormState<K> {
  const initialRef = useRef(initial);
  const [values, setValues] = useState<Record<K, string>>(initial);
  const [errors, setErrors] = useState<FieldErrors<K>>({});
  const elements = useRef<Partial<Record<K, HTMLInputElement | null>>>({});

  const field = useCallback(
    (key: K): FieldBinding => ({
      value: values[key],
      error: Boolean(errors[key]),
      onChange: (event) => {
        const next = event.target.value;
        setValues((current) => ({ ...current, [key]: next }));
        setErrors((current) => {
          if (!(key in current)) return current;
          const rest = { ...current };
          delete rest[key];
          return rest;
        });
      },
      ref: (element) => {
        elements.current[key] = element;
      },
    }),
    [values, errors],
  );

  const fail = useCallback((next: FieldErrors<K>) => {
    setErrors(next);
    const first = (Object.keys(initialRef.current) as K[]).find((key) => next[key]);
    if (first) elements.current[first]?.focus();
  }, []);

  const errorsFor = useCallback(
    (...keys: K[]) => keys.map((key) => errors[key]).filter((message): message is string => Boolean(message)),
    [errors],
  );

  const reset = useCallback(() => {
    setValues(initialRef.current);
    setErrors({});
  }, []);

  return { values, errors, field, fail, errorsFor, reset };
}

export function useResetOnOpen(open: boolean, reset: () => void): void {
  const resetRef = useRef(reset);
  useEffect(() => {
    resetRef.current = reset;
  });
  useEffect(() => {
    if (open) resetRef.current();
  }, [open]);
}
