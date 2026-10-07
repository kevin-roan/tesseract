import { useMemo } from "react";
import { useConnectionActions } from "../../app/connection";
import { useNavigateTo, usePreferencesRoute } from "../../app/navigation";
import { useActionMenu, type MenuSections } from "../../components/ActionMenu";
import { ipc } from "../../lib/ipc";
import { SHELL_LABELS } from "../labels";
import { openShellDialog } from "./use-shell-dialogs";

const L = SHELL_LABELS.menu;

export function useMainMenu() {
  const menu = useActionMenu();
  const navigateTo = useNavigateTo();
  const { openPreferences } = usePreferencesRoute();
  const connection = useConnectionActions();
  const sections = useMemo<MenuSections>(
    () => [
      [
        { id: "new-conversation", label: L.newConversation, onSelect: () => navigateTo("agents", { new: true }) },
        { id: "preferences", label: L.preferences, onSelect: () => openPreferences() },
        { id: "pair", label: L.pair, onSelect: () => openShellDialog("pair") },
        { id: "pair-host", label: L.pairHost, onSelect: () => openShellDialog("pair-host") },
        { id: "rediscover", label: L.rediscover, onSelect: () => void connection.rediscover().catch(() => undefined) },
      ],
      [
        { id: "about", label: L.about, onSelect: () => openShellDialog("about") },
        { id: "quit", label: L.quit, onSelect: () => void ipc.app.quit().catch(() => undefined) },
      ],
    ],
    [connection, navigateTo, openPreferences],
  );
  return { ...menu, sections };
}
