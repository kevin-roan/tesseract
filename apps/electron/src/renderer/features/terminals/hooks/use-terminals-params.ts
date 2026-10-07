import { useEffect, useRef } from "react";
import { useParams } from "react-router";
import { usePageParams } from "../../../app/navigation";
import { parseOpen } from "../model";
import type { TerminalActions } from "./use-terminal-actions";

export function useTerminalsParams(actions: TerminalActions, ready: boolean): void {
  const { params, at } = usePageParams();
  const splat = useParams()["*"] ?? "";
  const latest = useRef({ params, actions });
  latest.current = { params, actions };

  useEffect(() => {
    if (!ready || at === null) return;
    const request = parseOpen(latest.current.params);
    if (!request) return;
    if (request.type === "attach") latest.current.actions.select(request.terminalId);
    else void latest.current.actions.launch({ kind: request.kind, projectId: request.projectId });
  }, [at, ready]);

  useEffect(() => {
    if (ready && splat) latest.current.actions.select(decodeURIComponent(splat));
  }, [splat, ready]);
}
