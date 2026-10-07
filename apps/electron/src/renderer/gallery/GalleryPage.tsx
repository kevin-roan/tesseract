import { Link, useParams } from "react-router";
import { ROUTE } from "../../shared/routes";
import { findGalleryEntry, GALLERY_ENTRIES } from "../app/registry/gallery";
import { Text } from "../components/Text";
import { cx } from "../lib/cx";
import { GALLERY_LABELS } from "./labels";
import styles from "./GalleryPage.module.css";

export function GalleryPage() {
  const { entry: entryId } = useParams();
  const selected = findGalleryEntry(entryId);
  if (selected) {
    return (
      <div className={styles.single} data-gallery-entry={selected.id}>
        <div style={selected.width ? { width: selected.width } : undefined}>{selected.render()}</div>
      </div>
    );
  }
  return (
    <div className={styles.index}>
      <Text variant="h2">{GALLERY_LABELS.title}</Text>
      {GALLERY_ENTRIES.length === 0 ? (
        <Text variant="body" color="text-secondary">
          {GALLERY_LABELS.empty}
        </Text>
      ) : null}
      {GALLERY_ENTRIES.map((entry) => (
        <section key={entry.id} className={styles.entry}>
          <div className={styles.entryHeader}>
            <Text variant="caption" color="text-tertiary">
              {entry.group}
            </Text>
            <Link to={ROUTE.gallery(entry.id)} className={cx(styles.link)}>
              {entry.title}
            </Link>
          </div>
          <div style={entry.width ? { width: entry.width } : undefined}>{entry.render()}</div>
        </section>
      ))}
    </div>
  );
}
