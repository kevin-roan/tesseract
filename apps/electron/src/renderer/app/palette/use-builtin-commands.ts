import { useMemo } from "react";
import type { Appearance } from "../../../shared/runtime";
import { ipc } from "../../lib/ipc";
import { useConnectionActions } from "../connection";
import { useNavigateTo, usePreferencesRoute } from "../navigation";
import { PAGES } from "../registry/pages";
import { PREFERENCES_SECTIONS } from "../registry/preferences";
import { useSettings, useUpdateSettings } from "../settings";
import { primaryShortcut } from "../shortcuts/match";
import { zoomWindow } from "../shortcuts/use-shortcut-actions";
import { PALETTE_LABELS as L } from "./labels";
import type { PaletteCommand } from "./types";

const APPEARANCES: readonly Appearance[] = ["system", "light", "dark"];
const ignore = () => undefined;

export function useBuiltinCommands(): PaletteCommand[] {
  const navigateTo = useNavigateTo();
  const { openPreferences } = usePreferencesRoute();
  const connection = useConnectionActions();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const appearance = settings.appearance;
  const { mutate } = updateSettings;

  return useMemo(() => {
    const G = L.groups;
    const navigation: PaletteCommand[] = PAGES.map((page) => ({
      id: `page:${page.id}`,
      title: L.goTo(page.title),
      group: G.navigation,
      icon: page.icon,
      keywords: [page.id, page.title],
      run: () => navigateTo(page.id),
    }));
    const actions: PaletteCommand[] = [
      {
        id: "action:new-conversation",
        title: L.newConversation,
        group: G.actions,
        icon: "compose",
        keywords: L.keywords.newConversation,
        shortcut: primaryShortcut("newConversation"),
        run: () => navigateTo("agents", { new: true }),
      },
      {
        id: "action:refresh",
        title: L.refresh,
        group: G.actions,
        icon: "refresh",
        keywords: L.keywords.refresh,
        shortcut: primaryShortcut("refresh"),
        run: () => connection.refresh(),
      },
      {
        id: "action:rediscover",
        title: L.rediscover,
        group: G.actions,
        icon: "docker",
        keywords: L.keywords.rediscover,
        run: () => void connection.rediscover().catch(ignore),
      },
      {
        id: "action:setup-wizard",
        title: L.setupWizard,
        group: G.actions,
        icon: "whats-new",
        keywords: L.keywords.setupWizard,
        run: () => void ipc.window.openOnboarding().catch(ignore),
      },
    ];
    const preferences: PaletteCommand[] = [
      {
        id: "settings:open",
        title: L.openSettings,
        group: G.settings,
        icon: "settings",
        keywords: L.keywords.settings,
        shortcut: primaryShortcut("preferences"),
        run: () => openPreferences(),
      },
      ...PREFERENCES_SECTIONS.map((section) => ({
        id: `settings:${section.id}`,
        title: L.settingsSection(section.title),
        group: G.settings,
        icon: section.icon,
        keywords: [...L.keywords.settings, section.id],
        run: () => openPreferences(section.id),
      })),
    ];
    const appearanceCommands: PaletteCommand[] = APPEARANCES.filter((value) => value !== appearance).map((value) => ({
      id: `appearance:${value}`,
      title: L.appearance[value],
      group: G.appearance,
      icon: "appearance",
      keywords: L.keywords.appearance,
      run: () => mutate({ appearance: value }),
    }));
    const windowCommands: PaletteCommand[] = [
      { id: "window:zoom-in", title: L.zoomIn, group: G.window, icon: "add", keywords: L.keywords.zoom, shortcut: primaryShortcut("zoomIn"), run: () => zoomWindow(1) },
      { id: "window:zoom-out", title: L.zoomOut, group: G.window, icon: "minus", keywords: L.keywords.zoom, shortcut: primaryShortcut("zoomOut"), run: () => zoomWindow(-1) },
      { id: "window:zoom-reset", title: L.zoomReset, group: G.window, icon: "fit", keywords: L.keywords.zoom, shortcut: primaryShortcut("zoomReset"), run: () => zoomWindow(0) },
      { id: "window:close", title: L.closeWindow, group: G.window, icon: "close", shortcut: primaryShortcut("hide"), run: () => void ipc.window.close().catch(ignore) },
      { id: "window:quit", title: L.quit, group: G.window, icon: "logout", keywords: L.keywords.quit, shortcut: primaryShortcut("quit"), run: () => void ipc.app.quit().catch(ignore) },
    ];
    return [...navigation, ...actions, ...preferences, ...appearanceCommands, ...windowCommands];
  }, [appearance, connection, mutate, navigateTo, openPreferences]);
}
