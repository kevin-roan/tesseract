import type { Project } from "@tesseract/protocol";
import { useCallback, useState } from "react";
import { describeError, useConnectionClient } from "../../../app/connection";
import { showToast } from "../../../components/Toast";
import { MAX_NAME_LENGTH } from "../constants";
import { RENAME_LABELS, VALIDATION_LABELS } from "../labels";
import { renameError, renameValue } from "../model";
import { useDraftFields } from "./use-draft-fields";
import { useWorkspaceActions } from "./use-workspace";

export function useRenameProject(project: Project, onRenamed: (project: Project) => void, onClose: () => void) {
  const client = useConnectionClient();
  const workspace = useWorkspaceActions();
  const current = project.name || project.id;
  const fields = useDraftFields({ name: current });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reset: resetFields } = fields;

  const reset = useCallback(() => {
    resetFields({ name: current });
    setBusy(false);
    setError(null);
  }, [current, resetFields]);

  const submit = useCallback(async () => {
    if (busy || !client) return;
    setError(null);
    if (renameError(fields.values.name)) {
      fields.fail({ name: VALIDATION_LABELS.nameTooLong(MAX_NAME_LENGTH) });
      return;
    }
    const value = renameValue(fields.values.name);
    if (value === current) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const updated = await client.renameProject(project.id, { name: value });
      workspace.upsertProject(updated);
      onRenamed(updated);
      showToast(value === null ? RENAME_LABELS.reset(project.id) : RENAME_LABELS.renamed(updated.name));
      onClose();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }, [busy, client, current, fields, onClose, onRenamed, project.id, workspace]);

  return { fields, busy, error, submit, reset, context: current };
}
