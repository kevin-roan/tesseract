import { useState } from "react";

export interface LicenseReview {
  current: string | null;
  accepted: ReadonlySet<string>;
  allAccepted: boolean;
  show(id: string): void;
  setAccepted(id: string, on: boolean): void;
}

export function useLicenseReview(pending: readonly string[]): LicenseReview {
  const [shown, setShown] = useState<string | null>(null);
  const [accepted, setAcceptedSet] = useState<ReadonlySet<string>>(new Set());
  const current = shown && pending.includes(shown) ? shown : (pending[0] ?? null);
  const setAccepted = (id: string, on: boolean) => {
    const next = new Set(accepted);
    if (on) next.add(id);
    else next.delete(id);
    setAcceptedSet(next);
    if (on) {
      const following = pending.find((item) => !next.has(item));
      if (following) setShown(following);
    }
  };
  return {
    current,
    accepted,
    allAccepted: pending.length > 0 && pending.every((id) => accepted.has(id)),
    show: setShown,
    setAccepted,
  };
}
