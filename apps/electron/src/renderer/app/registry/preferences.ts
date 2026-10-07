import type { PreferencesSectionDefinition } from "../define";

const modules = import.meta.glob<{ default: PreferencesSectionDefinition }>(
  "../../pages/preferences/sections/*/section.ts",
  { eager: true },
);

export const PREFERENCES_SECTIONS: readonly PreferencesSectionDefinition[] = Object.values(modules)
  .map((module) => module.default)
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export function findPreferencesSection(id: string | null | undefined): PreferencesSectionDefinition | undefined {
  return PREFERENCES_SECTIONS.find((section) => section.id === id) ?? PREFERENCES_SECTIONS[0];
}
