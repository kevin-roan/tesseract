import { PAGE_IDS, PAGE_SECTIONS, type PageId } from "../../../shared/routes";
import type { PageDefinition } from "../define";

const modules = import.meta.glob<{ default: PageDefinition }>("../../pages/*/page.ts", { eager: true });

export const PAGES: readonly PageDefinition[] = Object.values(modules)
  .map((module) => module.default)
  .filter((page) => (PAGE_IDS as readonly string[]).includes(page.id))
  .sort(
    (a, b) =>
      PAGE_SECTIONS.indexOf(a.section) - PAGE_SECTIONS.indexOf(b.section) ||
      a.order - b.order ||
      a.title.localeCompare(b.title),
  );

export function findPage(id: string): PageDefinition | undefined {
  return PAGES.find((page) => page.id === id);
}

export function pagesBySection(): { section: PageDefinition["section"]; pages: PageDefinition[] }[] {
  return PAGE_SECTIONS.map((section) => ({ section, pages: PAGES.filter((page) => page.section === section) })).filter(
    (group) => group.pages.length > 0,
  );
}

export function isRegisteredPage(id: string): id is PageId {
  return PAGES.some((page) => page.id === id);
}
