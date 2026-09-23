import { useCallback, useState } from "react";

import type { PairedSandbox, PairingDraft, PairingErrors, PairingField, PairingStatus } from "../types";
import { describeError } from "../utils/errors";
import { EMPTY_PAIRING_DRAFT, isPairingLink, parsePairingText, validatePairingDraft } from "../utils/pairing";
import { usePairSandbox } from "./use-sandbox-mutations";

type FormState = {
  draft: PairingDraft;
  errors: PairingErrors;
  message: string | null;
};

export type PairingForm = {
  draft: PairingDraft;
  errors: PairingErrors;
  message: string | null;
  status: PairingStatus;
  setField: (field: PairingField, value: string) => void;
  applyLink: (text: string) => PairingDraft | null;
  submit: (override?: PairingDraft) => Promise<PairedSandbox | null>;
};

export function usePairingForm(initial?: PairingDraft | null): PairingForm {
  const pair = usePairSandbox();
  const [form, setForm] = useState<FormState>({ draft: initial ?? EMPTY_PAIRING_DRAFT, errors: {}, message: null });

  const setField = useCallback((field: PairingField, value: string) => {
    const pasted = field === "url" && isPairingLink(value) ? parsePairingText(value) : null;
    if (pasted?.ok) {
      setForm({ draft: pasted.draft, errors: {}, message: null });
      return;
    }
    setForm((current) => ({
      draft: { ...current.draft, [field]: value },
      errors: { ...current.errors, [field]: undefined },
      message: null,
    }));
  }, []);

  const applyLink = useCallback((text: string) => {
    const parsed = parsePairingText(text);
    if (!parsed.ok) {
      setForm((current) => ({ ...current, message: parsed.message }));
      return null;
    }
    setForm({ draft: parsed.draft, errors: {}, message: null });
    return parsed.draft;
  }, []);

  const { mutateAsync, reset } = pair;
  const submit = useCallback(
    async (override?: PairingDraft) => {
      const draft = override ?? form.draft;
      const validation = validatePairingDraft(draft);
      if (!validation.ok) {
        setForm({ draft, errors: validation.errors, message: null });
        return null;
      }
      reset();
      setForm({ draft, errors: {}, message: null });
      try {
        return await mutateAsync(validation.value);
      } catch (error) {
        setForm((current) => ({ ...current, message: describeError(error) }));
        return null;
      }
    },
    [form.draft, mutateAsync, reset],
  );

  const status: PairingStatus = pair.isPending
    ? "validating"
    : pair.isSuccess
      ? "paired"
      : form.message
        ? "error"
        : "idle";

  return { draft: form.draft, errors: form.errors, message: form.message, status, setField, applyLink, submit };
}
