import type { ProcessInfo } from "@tesseract/protocol";
import type { RecordRowProps, RowAction } from "../../../../components/RecordRow";
import type { PortEntry } from "./hooks/use-ports";
import { FIX_LABELS } from "../../../../features/projects/labels";
import { canFixProcess, isLiveProcess } from "../../../../features/projects/model";
import { PROCESSES_LABELS as L } from "./labels";
import { commandLabel, processMeta, processName, processStatus, scriptCommand } from "./model";

export interface PortRowHandlers {
  copy(url: string): void;
  open(url: string): void;
}

export function portRow({ port, url }: PortEntry, handlers: PortRowHandlers): RecordRowProps {
  const actions: RowAction[] = url
    ? [
        { id: "copy", icon: "copy", label: L.copy, onActivate: () => handlers.copy(url) },
        { id: "open", icon: "browser", label: L.open, onActivate: () => handlers.open(url) },
      ]
    : [];
  return {
    icon: "ports",
    title: L.port(port.port),
    subtitle: port.command || null,
    meta: url ?? L.noUrl,
    actions,
    onActivate: url ? () => handlers.open(url) : undefined,
  };
}

export interface ProcessRowState {
  logsOpen: boolean;
  fixPending: boolean;
  stopping: boolean;
  now?: number;
}

export interface ProcessRowHandlers {
  fix(process: ProcessInfo): void;
  toggleLogs(process: ProcessInfo): void;
  stop(process: ProcessInfo): void;
}

export function processRow(process: ProcessInfo, state: ProcessRowState, handlers: ProcessRowHandlers): RecordRowProps {
  const actions: RowAction[] = [];
  if (canFixProcess(process)) {
    actions.push({
      id: "fix",
      icon: "fix-ai",
      label: FIX_LABELS.action,
      sensitive: !state.fixPending,
      onActivate: () => handlers.fix(process),
    });
  }
  actions.push({
    id: "logs",
    icon: "terminal",
    label: state.logsOpen ? L.hideLogs : L.showLogs,
    active: state.logsOpen,
    onActivate: () => handlers.toggleLogs(process),
  });
  if (isLiveProcess(process)) {
    actions.push({
      id: "stop",
      icon: "stop",
      label: L.stop,
      destructive: true,
      sensitive: !state.stopping,
      onActivate: () => handlers.stop(process),
    });
  }
  return {
    icon: "processes",
    status: processStatus(process),
    title: processName(process),
    subtitle: commandLabel(process.command) || null,
    monospaceSubtitle: true,
    meta: processMeta(process, state.now),
    actions,
    onActivate: () => handlers.toggleLogs(process),
    selected: state.logsOpen,
  };
}

export interface ScriptRowHandlers {
  run(script: string, display: boolean): void;
}

export function scriptRow(script: string, pm: string, starting: boolean, handlers: ScriptRowHandlers): RecordRowProps {
  return {
    icon: "terminal",
    title: script,
    subtitle: scriptCommand(pm, script),
    monospaceTitle: true,
    monospaceSubtitle: true,
    actions: [
      { id: "display", icon: "display", label: L.runDisplay, sensitive: !starting, onActivate: () => handlers.run(script, true) },
      { id: "run", icon: "play", label: L.run, labeled: true, sensitive: !starting, onActivate: () => handlers.run(script, false) },
    ],
  };
}
