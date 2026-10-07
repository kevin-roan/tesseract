import { defineGalleryEntry } from "../../app/define";
import { PROJECT_GALLERY_CARDS, PROJECT_GALLERY_WIDTH } from "./gallery-samples";
import { ProjectGrid } from "./ProjectGrid";

export default defineGalleryEntry({
  id: "project-grid",
  title: "ProjectCard / ProjectGrid",
  group: "Projects",
  width: PROJECT_GALLERY_WIDTH,
  render: () => <ProjectGrid items={PROJECT_GALLERY_CARDS} onOpen={() => undefined} onAsk={() => undefined} />,
});
