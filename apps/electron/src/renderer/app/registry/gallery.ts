import type { GalleryEntry } from "../define";

const componentEntries = import.meta.glob<{ default: GalleryEntry }>("../../components/*/*.gallery.tsx", { eager: true });
const extraEntries = import.meta.glob<{ default: GalleryEntry }>("../../gallery/entries/*.gallery.tsx", { eager: true });

export const GALLERY_ENTRIES: readonly GalleryEntry[] = [...Object.values(componentEntries), ...Object.values(extraEntries)]
  .map((module) => module.default)
  .sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));

export function findGalleryEntry(id: string | undefined): GalleryEntry | undefined {
  return GALLERY_ENTRIES.find((entry) => entry.id === id);
}
