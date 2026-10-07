import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { ProjectPicker } from "../SidebarComposer";
import { Composer } from "./Composer";
import { COMPOSER_GALLERY, GALLERY_PROJECTS, noop } from "./gallery-samples";
import { COMPOSER_LABELS } from "./labels";
import styles from "./Composer.gallery.module.css";

function LargeComposerGallery() {
  const [text, setText] = useState("");
  const [project, setProject] = useState<string | null>(null);
  return (
    <div className={styles.card}>
      <Composer
        large
        value={text}
        onChange={setText}
        onSubmit={noop}
        placeholder={COMPOSER_LABELS.newPlaceholder}
        sendLabel={COMPOSER_LABELS.newSend}
        onAttach={noop}
        properties={<ProjectPicker variant="pill" projects={GALLERY_PROJECTS} value={project} onChange={setProject} />}
      />
    </div>
  );
}

export default defineGalleryEntry({
  id: "composer-large",
  title: "Composer (large)",
  group: "Composer",
  width: COMPOSER_GALLERY.largeWidth,
  render: () => <LargeComposerGallery />,
});
