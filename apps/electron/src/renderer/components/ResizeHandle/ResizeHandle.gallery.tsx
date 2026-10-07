import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { SIDEBAR_WIDTH } from "./constants";
import { RESIZE_GALLERY } from "./gallery-samples";
import { ResizeHandle } from "./ResizeHandle";
import styles from "./ResizeHandle.gallery.module.css";

function ResizeHandleDemo() {
  const [width, setWidth] = useState<number>(SIDEBAR_WIDTH.default);
  return (
    <div className={styles.frame}>
      <div className={styles.sidebar} style={{ width }}>
        {width}px
        <ResizeHandle width={width} onResize={setWidth} onCommit={setWidth} />
      </div>
      <div className={styles.content} />
    </div>
  );
}

export default defineGalleryEntry({
  id: "resize-handle",
  title: "ResizeHandle",
  group: "Layout",
  width: RESIZE_GALLERY.width,
  render: () => <ResizeHandleDemo />,
});
