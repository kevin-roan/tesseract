import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { GALLERY_GROUPS, noop } from "../../gallery/gallery-samples";
import { CONTAINER_SAMPLES, CONTAINER_STATE_SAMPLES, CONTAINERS_GALLERY_SAMPLE, CONTAINERS_LABEL_SAMPLE } from "./gallery-samples";
import { SidebarContainers } from "./SidebarContainers";
import styles from "./gallery.module.css";

function ContainersDemo() {
  const [selected, setSelected] = useState<string | null>(CONTAINERS_GALLERY_SAMPLE.selected);
  return (
    <div className={styles.stack}>
      <SidebarContainers
        state="ready"
        items={CONTAINER_SAMPLES}
        selected={selected}
        labels={CONTAINERS_LABEL_SAMPLE}
        onOpen={setSelected}
        onStart={noop}
        onStop={noop}
      />
      {CONTAINER_STATE_SAMPLES.map((state) => (
        <SidebarContainers key={state} state={state} items={[]} labels={CONTAINERS_LABEL_SAMPLE} onCreate={noop} onSetUp={noop} />
      ))}
    </div>
  );
}

export default defineGalleryEntry({
  id: CONTAINERS_GALLERY_SAMPLE.id,
  title: CONTAINERS_GALLERY_SAMPLE.title,
  group: GALLERY_GROUPS.appChrome,
  render: () => <ContainersDemo />,
});
