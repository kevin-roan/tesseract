import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import type { PreferencesSectionId } from "../../../shared/routes";
import { usePreferencesRoute } from "../../app/navigation";
import { findPreferencesSection, PREFERENCES_SECTIONS } from "../../app/registry/preferences";
import { useDialogBehavior } from "../../components/DialogShell";
import { NAV_INITIAL_FOCUS, NAV_KEYS } from "./constants";

export function nextSectionId(current: PreferencesSectionId, key: string): PreferencesSectionId | null {
  const ids = PREFERENCES_SECTIONS.map((section) => section.id);
  const index = ids.indexOf(current);
  if (index === -1 || ids.length === 0) return null;
  switch (key) {
    case NAV_KEYS.previous:
      return ids[Math.max(0, index - 1)] ?? null;
    case NAV_KEYS.next:
      return ids[Math.min(ids.length - 1, index + 1)] ?? null;
    case NAV_KEYS.first:
      return ids[0] ?? null;
    case NAV_KEYS.last:
      return ids[ids.length - 1] ?? null;
    default:
      return null;
  }
}

export function usePreferencesDialog() {
  const { open, section, openPreferences, closePreferences } = usePreferencesRoute();
  const current = open ? findPreferencesSection(section) : undefined;
  const currentId = current?.id ?? null;
  const bodyRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useDialogBehavior({ active: Boolean(current), sheetRef, onClose: closePreferences, initialFocus: NAV_INITIAL_FOCUS });

  useEffect(() => {
    if (!currentId) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [currentId]);

  const onNavKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!currentId) return;
      const target = nextSectionId(currentId, event.key);
      if (!target) return;
      event.preventDefault();
      openPreferences(target);
      const button = event.currentTarget.querySelector<HTMLElement>(`[data-section="${target}"]`);
      button?.focus();
    },
    [currentId, openPreferences],
  );

  return {
    open: Boolean(current),
    current,
    sections: PREFERENCES_SECTIONS,
    select: openPreferences,
    close: closePreferences,
    onNavKeyDown,
    bodyRef,
    sheetRef,
  };
}
