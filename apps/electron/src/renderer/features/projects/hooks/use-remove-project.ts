import type { Project } from "@theone/protocol";
import { useCallback, useState } from "react";
import { describeError, useConnectionClient } from "../../../app/connection";
import { showToast } from "../../../components/Toast";
import { REMOVE_LABELS } from "../labels";
import { removalPrompt } from "../model";
import type { RemovalPrompt } from "../types";
import { useWorkspaceActions } from "./use-workspace";

export function useRemoveProject(project: Project | null, onRemoved: () => void) {
  const client = useConnectionClient();
  const workspace = useWorkspaceActions();
  const [prompt, setPrompt] = useState<RemovalPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const name = project ? project.name || project.id : "";

  const start = useCallback(async () => {
    if (!project || !client || checking) return;
    setChecking(true);
    try {
      const sync = await client.syncChanges(project.id);
      setPrompt(removalPrompt(name, sync));
      setOpen(true);
    } catch (error) {
      showToast(REMOVE_LABELS.failed(name, describeError(error)));
    } finally {
      setChecking(false);
    }
  }, [project, client, checking, name]);

  const confirm = useCallback(async () => {
    if (!project || !client || !prompt) return;
    const force = prompt.force;
    try {
      await client.deleteProject(project.id, force ? { force: true } : undefined);
      workspace.removeProject(project.id);
      showToast(REMOVE_LABELS.deleted(name));
      onRemoved();
    } catch (error) {
      showToast(REMOVE_LABELS.failed(name, describeError(error)));
    }
  }, [project, client, prompt, workspace, name, onRemoved]);

  const cancel = useCallback(() => setOpen(false), []);

  return { prompt, open, checking, start, confirm, cancel };
}
