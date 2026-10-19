import type { TerminalInfo } from "@tesseract/protocol";
import { useCallback } from "react";
import { useConnection, useConnectionActions } from "../../../app/connection";
import { usePreferencesRoute } from "../../../app/navigation";
import { useWorkspaceProjects } from "../../projects/hooks/use-workspace";
import { CONNECTION_ACTION_LABELS } from "../labels";
import { connectionEmpty, rowModel, sessionTitle } from "../model";
import type { LiveSession, TerminalsEmptyModel } from "../types";
import { useTerminalsWorkspace } from "./use-terminals-workspace";

export function useTerminalsPage() {
  const connection = useConnection();
  const connectionActions = useConnectionActions();
  const { openPreferences } = usePreferencesRoute();
  const { projects } = useWorkspaceProjects();

  const titleOf = useCallback((info: TerminalInfo) => sessionTitle(info, projects), [projects]);
  const rowOf = useCallback((info: TerminalInfo, now: number, live: LiveSession | undefined) => rowModel(info, projects, now, live), [projects]);
  const workspace = useTerminalsWorkspace({ titleOf, rowOf });

  const status = workspace.attached.length === 0 ? connectionEmpty(connection.status, connection.errorMessage) : null;
  const empty: TerminalsEmptyModel | null = status
    ? {
        title: status.title,
        message: status.message,
        loading: status.loading,
        icon: status.icon,
        actionLabel: status.action ? CONNECTION_ACTION_LABELS[status.action] : null,
        secondaryLabel: null,
      }
    : null;

  const onEmptyAction = useCallback(() => {
    if (status?.action === "retry") connectionActions.refresh();
    else if (status?.action === "preferences") openPreferences("connection");
  }, [status?.action, connectionActions, openPreferences]);

  return { ...workspace, empty, onEmptyAction, onEmptySecondary: null, projects };
}
