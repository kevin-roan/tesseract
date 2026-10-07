import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { SEARCH_FIELD_GALLERY } from "./gallery-samples";
import { SearchField } from "./SearchField";
import styles from "./SearchField.gallery.module.css";

function SearchFieldGallery() {
  const [conversations, setConversations] = useState("");
  const [projects, setProjects] = useState<string>(SEARCH_FIELD_GALLERY.query);
  const [files, setFiles] = useState("");
  return (
    <div className={styles.column}>
      <SearchField value={conversations} onChange={setConversations} placeholder={SEARCH_FIELD_GALLERY.conversations} />
      <SearchField value={projects} onChange={setProjects} placeholder={SEARCH_FIELD_GALLERY.projects} />
      <SearchField value={files} onChange={setFiles} size="md" placeholder={SEARCH_FIELD_GALLERY.files} />
    </div>
  );
}

export default defineGalleryEntry({
  id: "search-field",
  title: "SearchField",
  group: "Form controls",
  render: () => <SearchFieldGallery />,
});
