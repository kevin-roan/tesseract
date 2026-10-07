import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { SIDEBAR_GALLERY, SIDEBAR_GALLERY_PROJECTS } from "./gallery-samples";
import { SidebarComposer } from "./SidebarComposer";
import { useProjectSelection } from "./use-project-selection";
import styles from "./SidebarComposer.gallery.module.css";

function SidebarComposerDemo({ online }: { online: boolean }) {
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useProjectSelection(SIDEBAR_GALLERY_PROJECTS);
  return (
    <SidebarComposer
      value={text}
      onChange={setText}
      onSend={() => setText("")}
      online={online}
      projects={SIDEBAR_GALLERY_PROJECTS}
      projectId={projectId}
      onProjectChange={setProjectId}
      onAttach={() => undefined}
      onDropFiles={() => undefined}
    />
  );
}

export default defineGalleryEntry({
  id: "sidebar-composer",
  title: "SidebarComposer",
  group: "Composer",
  width: SIDEBAR_GALLERY.width,
  render: () => (
    <div className={styles.footer}>
      <SidebarComposerDemo online={false} />
      <SidebarComposerDemo online />
    </div>
  ),
});
