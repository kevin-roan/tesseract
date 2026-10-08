import { TERMINAL_KINDS, normalizeProjectId, type TerminalKind } from "@tesseract/protocol";

import type { TerminalLaunch } from "../types";

const NEW_ROUTE_ID = "new";

type Param = string | string[] | undefined;

export const firstParam = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);

const isTerminalKind = (value: string | undefined): value is TerminalKind =>
  value !== undefined && (TERMINAL_KINDS as readonly string[]).includes(value);

export function projectIdParam(value: Param): string | null {
  const raw = firstParam(value);
  return raw ? normalizeProjectId(raw) : null;
}

export function terminalLaunchFromParams(params: { id?: Param; kind?: Param; projectId?: Param }): TerminalLaunch | null {
  if (firstParam(params.id) !== NEW_ROUTE_ID) return null;
  const kind = firstParam(params.kind);
  const projectId = projectIdParam(params.projectId);
  return { kind: isTerminalKind(kind) ? kind : "shell", ...(projectId ? { projectId } : {}) };
}

export const isNewRoute = (id: Param): boolean => firstParam(id) === NEW_ROUTE_ID;
