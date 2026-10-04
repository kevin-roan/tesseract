import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import type { PairingDraft, PairingErrors, PairingField, PairingStatus } from "@/features/sandbox/types";
import { EMPTY_PAIRING_DRAFT, isPairingLink, validatePairingDraft, type ValidPairing } from "@/features/sandbox/utils/pairing";

import { createHostProbeClient } from "../api/client";
import { useHostStore } from "../store/host-store";
import type { PairedHost } from "../types";
import { describeHostError } from "../utils/errors";
import { hostName, parseHostPairingText } from "../utils/pairing";

type FormState = { draft: PairingDraft; errors: PairingErrors; message: string | null };

async function probeAndPair(input: ValidPairing, pair: ReturnType<typeof useHostStore.getState>["pair"]): Promise<PairedHost> {
  const probe = createHostProbeClient(input.baseUrl, input.token);
  const health = await probe.hostHealth();
  await probe.lockStatus();
  return pair({ name: hostName(input.name, health.hostId), baseUrl: input.baseUrl, token: input.token });
}

export function useHostPairing(initial: PairingDraft | null, onPaired: (host: PairedHost) => void) {
  const pair = useHostStore((state) => state.pair);
  const mutation = useMutation({ mutationFn: (input: ValidPairing) => probeAndPair(input, pair) });
  const [form, setForm] = useState<FormState>({ draft: initial ?? EMPTY_PAIRING_DRAFT, errors: {}, message: null });

  const setField = useCallback((field: PairingField, value: string) => {
    const pasted = field === "url" && isPairingLink(value) ? parseHostPairingText(value) : null;
    if (pasted?.ok) return setForm({ draft: pasted.draft, errors: {}, message: null });
    setForm((current) => ({
      draft: { ...current.draft, [field]: value },
      errors: { ...current.errors, [field]: undefined },
      message: null,
    }));
  }, []);

  const { mutateAsync, reset } = mutation;
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
        const host = await mutateAsync(validation.value);
        onPaired(host);
        return host;
      } catch (error) {
        setForm((current) => ({ ...current, message: describeHostError(error) }));
        return null;
      }
    },
    [form.draft, mutateAsync, reset, onPaired],
  );

  const onCode = useCallback(
    async (text: string) => {
      const parsed = parseHostPairingText(text);
      if (!parsed.ok) return setForm((current) => ({ ...current, message: parsed.message }));
      await submit(parsed.draft);
    },
    [submit],
  );

  const status: PairingStatus = mutation.isPending ? "validating" : mutation.isSuccess ? "paired" : form.message ? "error" : "idle";

  return { ...form, status, setField, submit: () => void submit(), onCode };
}
