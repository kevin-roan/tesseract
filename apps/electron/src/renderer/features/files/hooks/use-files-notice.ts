import { useCallback, useMemo, useState } from "react";

export interface FilesNotice {
  message: string | null;
  report(message: string): void;
  dismiss(): void;
}

export function useFilesNotice(): FilesNotice {
  const [message, setMessage] = useState<string | null>(null);
  const report = useCallback((next: string) => setMessage(next), []);
  const dismiss = useCallback(() => setMessage(null), []);
  return useMemo(() => ({ message, report, dismiss }), [message, report, dismiss]);
}
