import { useCallback, useState } from "react";
import { LIMITS, type AgentRun } from "@theone/protocol";

import { describeError } from "../utils/errors";
import { useStartAgentRun } from "./use-sandbox-mutations";

type ComposerOptions = {
  defaultProjectId?: string | null;
  resumeSessionId?: string | null;
  onStarted: (run: AgentRun) => void;
};

export function useAgentComposer({ defaultProjectId = null, resumeSessionId = null, onStarted }: ComposerOptions) {
  const [prompt, setPrompt] = useState("");
  const [chosenProjectId, setChosenProjectId] = useState<string | null | undefined>(undefined);
  const start = useStartAgentRun();
  const projectId = chosenProjectId === undefined ? defaultProjectId : chosenProjectId;
  const trimmed = prompt.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= LIMITS.maxPromptLength && !start.isPending;
  const { mutate } = start;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    mutate(
      {
        prompt: trimmed,
        ...(projectId ? { projectId } : {}),
        ...(resumeSessionId ? { resumeSessionId } : {}),
      },
      {
        onSuccess: (run) => {
          setPrompt("");
          onStarted(run);
        },
      },
    );
  }, [canSubmit, mutate, trimmed, projectId, resumeSessionId, onStarted]);

  const toggleProject = useCallback(
    (id: string) => setChosenProjectId((current) => ((current === undefined ? defaultProjectId : current) === id ? null : id)),
    [defaultProjectId],
  );

  return {
    prompt,
    setPrompt,
    projectId,
    toggleProject,
    canSubmit,
    submit,
    isSubmitting: start.isPending,
    error: start.error ? describeError(start.error) : null,
  };
}
