import { useCallback, useState } from "react";

/** A local edit of a server value: shows the server value until the user types, and commits only a real change. */
export function useDraftText(source: string, save: (value: string) => void, required = false) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = useCallback(() => {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next === source.trim() || (required && next.length === 0)) return;
    save(next);
  }, [draft, source, save, required]);

  const begin = useCallback(() => setDraft(source), [source]);
  const cancel = useCallback(() => setDraft(null), []);

  return { value: draft ?? source, editing: draft !== null, setValue: setDraft, begin, commit, cancel };
}
