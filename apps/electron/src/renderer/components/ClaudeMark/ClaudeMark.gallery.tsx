import { defineGalleryEntry } from "../../app/define";
import { GalleryRow } from "../../gallery/group-0";
import { ClaudeMark } from "./ClaudeMark";
import { CLAUDE_MARK_LABEL, CLAUDE_MARK_SIZES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "claude-mark",
  title: "ClaudeMark",
  group: "Indicators",
  render: () => (
    <GalleryRow>
      {CLAUDE_MARK_SIZES.map((size) => (
        <ClaudeMark key={size} size={size} label={CLAUDE_MARK_LABEL} />
      ))}
      {CLAUDE_MARK_SIZES.map((size) => (
        <ClaudeMark key={`badge-${size}`} size={size} badge />
      ))}
    </GalleryRow>
  ),
});
