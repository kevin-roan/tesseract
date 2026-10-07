import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { TEXT_FIELD_GALLERY } from "./gallery-samples";
import { TextField } from "./TextField";
import styles from "./TextField.gallery.module.css";

function TextFieldGallery() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState<string>(TEXT_FIELD_GALLERY.token);
  const [name, setName] = useState("");
  return (
    <div className={styles.column}>
      <TextField value={url} onChange={setUrl} placeholder={TEXT_FIELD_GALLERY.urlPlaceholder} />
      <TextField value={token} onChange={setToken} password mono />
      <TextField value={name} onChange={setName} tone="surface" placeholder={TEXT_FIELD_GALLERY.name} />
      <TextField value={TEXT_FIELD_GALLERY.invalid} tone="surface" error readOnly />
      <TextField value="" size="sm" placeholder={TEXT_FIELD_GALLERY.compact} disabled />
    </div>
  );
}

export default defineGalleryEntry({
  id: "text-field",
  title: "TextField",
  group: "Form controls",
  render: () => <TextFieldGallery />,
});
