import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SetupChoices, ValidationIssue } from "../../../../shared/contracts/sandbox";
import { ipc } from "../../../lib/ipc";
import { SANDBOX_QUERY_KEYS, VALIDATE_DEBOUNCE_MS, VALIDATE_GC_MS } from "../constants";
import { issuesByField, validationInput, type FieldIssues } from "../model";

const NO_ISSUES: readonly ValidationIssue[] = [];

export interface SandboxForm {
  choices: SetupChoices;
  issues: readonly ValidationIssue[];
  fieldIssues: FieldIssues;
  validating: boolean;
  revision: number;
  update(patch: Partial<SetupChoices>): void;
  replace(next: SetupChoices): void;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useSandboxForm(initial: SetupChoices): SandboxForm {
  const [choices, setChoices] = useState(initial);
  const [revision, setRevision] = useState(0);
  const input = useMemo(() => validationInput(choices), [choices]);
  const debounced = useDebounced(input, VALIDATE_DEBOUNCE_MS);
  const validation = useQuery({
    queryKey: [...SANDBOX_QUERY_KEYS.validate, debounced],
    queryFn: () => ipc.sandbox.validate(debounced).catch(() => NO_ISSUES),
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: VALIDATE_GC_MS,
    retry: false,
  });

  const update = useCallback((patch: Partial<SetupChoices>) => {
    setChoices((current) => ({ ...current, ...patch }));
    setRevision((value) => value + 1);
  }, []);
  const replace = useCallback((next: SetupChoices) => {
    setChoices(next);
    setRevision((value) => value + 1);
  }, []);

  const issues = validation.data ?? NO_ISSUES;
  const fieldIssues = useMemo(() => issuesByField(issues), [issues]);
  const validating = validation.isPending;
  return { choices, issues, fieldIssues, validating, revision, update, replace };
}
