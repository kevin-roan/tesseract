import type { RecordRowProps, RowAction } from "../../components/RecordRow";
import { PROCESSES_LABELS as L } from "../../features/processes/labels";
import type { ProcessRowModel, ProcessTarget } from "../../features/processes/types";

export interface ProcessRowHandlers {
  stop(target: ProcessTarget): void;
  kill(target: ProcessTarget): void;
}

export function processRow(row: ProcessRowModel, icon: RecordRowProps["icon"], stopping: boolean, handlers: ProcessRowHandlers): RecordRowProps {
  const sensitive = row.canStop && !stopping;
  const actions: RowAction[] = [
    { id: "stop", icon: "stop", label: L.actions.stop, labeled: true, sensitive, onActivate: () => handlers.stop(row.target) },
    { id: "kill", icon: "failed", label: L.actions.kill, labeled: true, destructive: true, sensitive, onActivate: () => handlers.kill(row.target) },
  ];
  return {
    icon,
    title: row.title,
    subtitle: row.subtitle,
    meta: row.meta || null,
    status: row.status,
    actions,
  };
}
