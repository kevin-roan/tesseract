import { useEffect } from "react";
import { useSearchParams } from "react-router";
import type { AppCommand } from "../../shared/contracts/app";
import { ipc } from "../lib/ipc";
import { useNavigateTo, usePreferencesRoute } from "./navigation";

type CommandHandler = (command: AppCommand) => boolean;
type RouteAction = Extract<AppCommand["type"], "pair" | "pair-host" | "about">;

export const ACTION_PARAM = "action";
const ROUTE_ACTIONS: readonly RouteAction[] = ["pair", "pair-host", "about"];

const extraHandlers = new Set<CommandHandler>();
const pending: AppCommand[] = [];

function dispatchToHandlers(command: AppCommand): boolean {
  for (const handler of extraHandlers) if (handler(command)) return true;
  return false;
}

export function registerCommandHandler(handler: CommandHandler): () => void {
  extraHandlers.add(handler);
  for (let index = pending.length - 1; index >= 0; index -= 1) {
    if (handler(pending[index]!)) pending.splice(index, 1);
  }
  return () => {
    extraHandlers.delete(handler);
  };
}

export function isRouteAction(value: string | null): value is RouteAction {
  return value !== null && (ROUTE_ACTIONS as readonly string[]).includes(value);
}

export function dispatchRouteAction(action: RouteAction): void {
  const command: AppCommand = { type: action };
  if (!dispatchToHandlers(command)) pending.push(command);
}

function useRouteAction(): void {
  const [search, setSearch] = useSearchParams();
  const action = search.get(ACTION_PARAM);
  useEffect(() => {
    if (action === null) return;
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(ACTION_PARAM);
        return next;
      },
      { replace: true },
    );
    if (isRouteAction(action)) dispatchRouteAction(action);
  }, [action, setSearch]);
}

export function useAppCommands(): void {
  const navigateTo = useNavigateTo();
  const { openPreferences } = usePreferencesRoute();
  useRouteAction();
  useEffect(() => {
    const unsubscribe = ipc.app.on("command", (command) => {
      if (dispatchToHandlers(command)) return;
      if (command.type === "navigate") navigateTo(command.page, command.params);
      else if (command.type === "preferences") openPreferences(command.section);
      else if (command.type === "new-conversation") navigateTo("agents", { new: true });
    });
    void ipc.app.rendererIdle().catch(() => undefined);
    return unsubscribe;
  }, [navigateTo, openPreferences]);
}
