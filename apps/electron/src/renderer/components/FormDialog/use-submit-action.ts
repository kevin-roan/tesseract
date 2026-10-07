import { useCallback, useEffect, useRef, useState } from "react";

export interface SubmitAction {
  busy: boolean;
  error: string | null;
  setError(message: string | null): void;
  run(action: () => Promise<void>, describe: (error: unknown) => string): Promise<boolean>;
  reset(): void;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function useSubmitAction(): SubmitAction {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<void>, describe: (error: unknown) => string) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      if (mounted.current) setBusy(false);
      return true;
    } catch (failure) {
      if (mounted.current) {
        setBusy(false);
        setError(describe(failure));
      }
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setBusy(false);
    setError(null);
  }, []);

  return { busy, error, setError, run, reset };
}
