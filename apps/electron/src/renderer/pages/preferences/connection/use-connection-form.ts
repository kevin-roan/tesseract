import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeError, useConnection, useConnectionActions } from "../../../app/connection";
import { usePreferencesToast } from "../shared/use-preferences-toast";
import { CONNECTION_FORM_TOASTS } from "./labels";
import { connectionStatusRows, EMPTY_FORM, formFromConfig, readConnectionForm, type ConnectionForm } from "./model";

export function useConnectionForm() {
  const state = useConnection();
  const actions = useConnectionActions();
  const toast = usePreferencesToast();
  const [form, setForm] = useState<ConnectionForm>(() => formFromConfig(state.config));
  const [saving, setSaving] = useState(false);
  const filled = useRef(state.config !== null);

  useEffect(() => {
    if (filled.current || !state.config) return;
    filled.current = true;
    setForm(formFromConfig(state.config));
  }, [state.config]);

  const setField = useCallback((field: keyof ConnectionForm) => (value: string) => setForm((current) => ({ ...current, [field]: value })), []);
  const fields = useMemo(
    () => ({ apiUrl: setField("apiUrl"), token: setField("token"), name: setField("name"), pairingUrl: setField("pairingUrl") }),
    [setField],
  );

  const status = connectionStatusRows(state);
  const discovering = status.discovering;

  const save = useCallback(async () => {
    if (discovering) return;
    const input = readConnectionForm(form);
    if (!input) {
      toast(CONNECTION_FORM_TOASTS.invalid);
      return;
    }
    setSaving(true);
    try {
      await actions.save(input);
      filled.current = true;
      toast(CONNECTION_FORM_TOASTS.saved);
    } catch (error) {
      toast(describeError(error), true);
    } finally {
      setSaving(false);
    }
  }, [actions, discovering, form, toast]);

  const rediscover = useCallback(async () => {
    const result = await actions.rediscover();
    if (!result.ok) {
      toast(CONNECTION_FORM_TOASTS.discoveryFailed(result.error), true);
      return;
    }
    filled.current = true;
    setForm(formFromConfig(result.config));
    toast(result.message, true);
  }, [actions, toast]);

  const forget = useCallback(async () => {
    if (discovering) return;
    filled.current = true;
    setForm(EMPTY_FORM);
    try {
      await actions.forget();
    } catch (error) {
      toast(describeError(error), true);
    }
  }, [actions, discovering, toast]);

  return {
    form,
    fields,
    saving,
    status,
    save: () => void save(),
    rediscover: () => void rediscover(),
    forget: () => void forget(),
  };
}
