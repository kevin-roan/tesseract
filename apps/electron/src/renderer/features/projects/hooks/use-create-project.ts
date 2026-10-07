import type { Project } from "@theone/protocol";
import { useCallback, useRef, useState } from "react";
import { describeError, useConnectionClient } from "../../../app/connection";
import { showToast } from "../../../components/Toast";
import { PROJECTS_ROOT } from "../constants";
import { CREATE_LABELS, VALIDATION_LABELS } from "../labels";
import { cloneOutcome, createLabel, isConflict, locationHint, validateProjectDraft } from "../model";
import { pseudonym } from "../pseudonym";
import type { CloneOutcome, FieldKey } from "../types";
import { mapErrors, projectErrorMessage } from "../validation";
import { useDraftFields } from "./use-draft-fields";
import { useWorkspaceActions } from "./use-workspace";

export interface CloneJob {
  processId: string;
  project: Project;
  title: string;
  logTitle: string;
}

const EMPTY_DRAFT: Record<FieldKey, string> = { name: "", git_url: "", branch: "" };

export function useCreateProject(onCreated: (project: Project) => void, onClose: () => void) {
  const client = useConnectionClient();
  const workspace = useWorkspaceActions();
  const fields = useDraftFields(EMPTY_DRAFT);
  const [confidential, setConfidential] = useState(false);
  const typedName = useRef("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clone, setClone] = useState<CloneJob | null>(null);
  const [outcome, setOutcome] = useState<CloneOutcome>(() => cloneOutcome(null, false));
  const [finished, setFinished] = useState(false);
  const { setValue, reset: resetFields } = fields;

  const reroll = useCallback(() => {
    setValue("name", pseudonym([...workspace.knownIds(), fields.values.name]));
  }, [setValue, workspace, fields.values.name]);

  const toggleConfidential = useCallback(() => {
    if (confidential) setValue("name", typedName.current);
    else {
      typedName.current = fields.values.name;
      setValue("name", pseudonym([...workspace.knownIds(), fields.values.name]));
    }
    setConfidential(!confidential);
  }, [confidential, fields.values.name, setValue, workspace]);

  const reset = useCallback(() => {
    resetFields(EMPTY_DRAFT);
    setConfidential(false);
    typedName.current = "";
    setBusy(false);
    setError(null);
    setClone(null);
    setFinished(false);
    setOutcome(cloneOutcome(null, false));
  }, [resetFields]);

  const submit = useCallback(async () => {
    if (busy || !client) return;
    const result = validateProjectDraft(
      { name: fields.values.name, gitUrl: fields.values.git_url, branch: fields.values.branch, confidential },
      workspace.knownIds(),
    );
    setError(null);
    fields.fail(mapErrors(result.errors, (code) => projectErrorMessage(code, result.projectId)));
    if (!result.ok) return;
    setBusy(true);
    try {
      const created = await client.createProject({
        name: result.name,
        ...(result.gitUrl ? { gitUrl: result.gitUrl } : {}),
        ...(result.branch ? { branch: result.branch } : {}),
        ...(result.confidential ? { confidential: true } : {}),
      });
      workspace.upsertProject(created.project);
      workspace.refresh();
      if (!created.processId) {
        showToast(CREATE_LABELS.created(created.project.name || created.project.id));
        onClose();
        onCreated(created.project);
        return;
      }
      setClone({
        processId: created.processId,
        project: created.project,
        title: CREATE_LABELS.cloningTitle(created.project.name || created.project.id),
        logTitle: [result.gitUrl, result.branch].filter(Boolean).join(" "),
      });
    } catch (failure) {
      if (isConflict(failure)) fields.fail({ name: VALIDATION_LABELS.nameExists(PROJECTS_ROOT, result.projectId ?? "") });
      else setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }, [busy, client, confidential, fields, onClose, onCreated, workspace]);

  const cloneExited = useCallback(
    (code: number | null) => {
      setFinished(true);
      setOutcome(cloneOutcome(code, true));
      workspace.refresh();
    },
    [workspace],
  );

  const close = useCallback(() => {
    if (clone && !finished) showToast(CREATE_LABELS.background);
    onClose();
  }, [clone, finished, onClose]);

  const openCloned = useCallback(() => {
    if (!clone) return;
    onClose();
    onCreated(clone.project);
  }, [clone, onClose, onCreated]);

  return {
    fields,
    confidential,
    toggleConfidential,
    reroll,
    busy,
    error,
    submit,
    reset,
    close,
    clone,
    outcome,
    finished,
    cloneExited,
    openCloned,
    hint: locationHint(fields.values.name),
    submitLabel: createLabel(fields.values.git_url),
    sourceHint: confidential ? CREATE_LABELS.sourceHintConfidential : CREATE_LABELS.sourceHint,
    openLabel: outcome.tone === "success" ? CREATE_LABELS.openProject : CREATE_LABELS.openAnyway,
  };
}
