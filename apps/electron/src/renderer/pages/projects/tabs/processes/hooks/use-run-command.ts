import type { ProcessInfo, Project } from "@theone/protocol";
import { useCallback, useState, type ChangeEvent } from "react";
import type { TheOneClient } from "@theone/client";
import { describeError } from "../../../../../app/connection";
import { useFormState, useResetOnOpen, useSubmitAction } from "../../../../../components/FormDialog";
import { RUN_LABELS } from "../../../../../features/projects/labels";
import { isConflict, prefersDisplay, validateProcessDraft } from "../../../../../features/projects/model";
import type { ProcessFieldKey } from "../../../../../features/projects/types";
import { mapErrors, processErrorMessage } from "../../../../../features/projects/validation";
import { PORT_INPUT } from "../constants";
import { KIT_LABELS } from "../../kit";

export interface RunCommandInput {
  project: Project;
  client: TheOneClient | null;
  open: boolean;
  onStarted(process: ProcessInfo): void;
  onClose(): void;
}

const EMPTY: Record<ProcessFieldKey, string> = { command: "", name: "", port: "" };

export function useRunCommand({ project, client, open, onStarted, onClose }: RunCommandInput) {
  const form = useFormState<ProcessFieldKey>(EMPTY);
  const submit = useSubmitAction();
  const [display, setDisplay] = useState(() => prefersDisplay(project.framework));

  useResetOnOpen(open, () => {
    form.reset();
    submit.reset();
    setDisplay(prefersDisplay(project.framework));
  });

  const portField = form.field("port");
  const port = {
    ...portField,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      if (PORT_INPUT.test(event.target.value)) portField.onChange(event);
    },
  };

  const run = useCallback(async () => {
    const draft = validateProcessDraft({ ...form.values, display }, project.id);
    form.fail(mapErrors(draft.errors, processErrorMessage));
    if (!draft.ok) return;
    let process: ProcessInfo | null = null;
    const ok = await submit.run(
      async () => {
        if (!client) throw new Error(KIT_LABELS.notConnected);
        process = await client.startProcess(draft.body);
      },
      (error) => {
        if (draft.body.port !== undefined && isConflict(error)) {
          form.fail({ port: RUN_LABELS.portTaken(String(draft.body.port), describeError(error)) });
          return "";
        }
        return describeError(error);
      },
    );
    if (ok && process) {
      onClose();
      onStarted(process);
    }
  }, [form, display, project.id, submit, client, onClose, onStarted]);

  return {
    command: form.field("command"),
    name: form.field("name"),
    port,
    commandErrors: form.errorsFor("command"),
    detailErrors: form.errorsFor("name", "port"),
    display,
    toggleDisplay: () => setDisplay((value) => !value),
    busy: submit.busy,
    error: submit.error || null,
    onSubmit: () => void run(),
  };
}
