import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow, GalleryStage } from "../../gallery/group-0";
import { ActionButton } from "../ActionButton";
import { Toast } from "./Toast";
import { ToastHost } from "./ToastHost";
import { showToast } from "./store";
import { TOAST_GALLERY as T } from "./gallery-samples";

export default defineGalleryEntry({
  id: "toast",
  title: "Toast",
  group: "Feedback",
  width: 560,
  render: () => (
    <GalleryColumn>
      <GalleryRow>
        <Toast message={T.copied} onDismiss={() => undefined} />
      </GalleryRow>
      <GalleryRow>
        <Toast message={T.archived} action={{ label: T.undo, run: () => undefined }} onDismiss={() => undefined} />
      </GalleryRow>
      <GalleryStage tall>
        <GalleryRow>
          <ActionButton label={T.show} onClick={() => showToast(T.zoom, { scope: T.scope })} />
        </GalleryRow>
        <ToastHost scope={T.scope} />
      </GalleryStage>
    </GalleryColumn>
  ),
});
