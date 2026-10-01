import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import type { PairedSandbox, PairingDraft } from "../types";
import { draftFromSearchParams } from "../utils/pairing";
import { usePairingForm } from "./use-pairing-form";
import { useQrScanner } from "./use-qr-scanner";
import { useSandboxNavigation } from "./use-sandbox-navigation";

export function usePairScreen() {
  const nav = useSandboxNavigation();
  const params = useLocalSearchParams<{ url?: string; token?: string; name?: string }>();
  const [initial] = useState<PairingDraft | null>(() => draftFromSearchParams(params));
  const form = usePairingForm(initial);
  const { applyLink, submit } = form;

  const [paired, setPaired] = useState<PairedSandbox | null>(null);

  useEffect(() => {
    if (paired) nav.hub();
  }, [paired, nav]);

  const finish = useCallback((sandbox: PairedSandbox | null) => {
    if (sandbox) setPaired(sandbox);
  }, []);

  const pair = useCallback(() => void submit().then(finish), [submit, finish]);

  const onCode = useCallback(
    async (data: string) => {
      const draft = applyLink(data);
      if (draft) finish(await submit(draft));
    },
    [applyLink, submit, finish],
  );

  const scanner = useQrScanner(onCode, form.status === "validating");

  return {
    nav,
    form,
    scanner,
    pair,
    fromLink: Boolean(initial?.token),
    canRescan: form.status === "error",
  };
}
