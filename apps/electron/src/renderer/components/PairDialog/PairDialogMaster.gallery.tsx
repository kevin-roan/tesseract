import { defineGalleryEntry } from "../../app/define";
import { PAIR_LINK_ERROR, PAIR_MASTER_SAMPLES, PAIR_SAMPLES } from "./gallery-samples";
import { PairDialog } from "./PairDialog";
import styles from "./PairDialog.gallery.module.css";

const noop = () => undefined;
const resolved = () => Promise.resolve();
const rejected = () => Promise.reject(new Error(PAIR_LINK_ERROR));

export default defineGalleryEntry({
  id: "pair-dialog-master",
  title: "PairDialog (Master host)",
  group: "Dialogs",
  render: () => (
    <div className={styles.row}>
      {PAIR_MASTER_SAMPLES.map((sample) => (
        <PairDialog
          key={sample.id}
          presentation="inline"
          initialTarget="master"
          onClose={noop}
          sandbox={PAIR_SAMPLES.sandbox}
          host={PAIR_SAMPLES.hostNoPin}
          master={sample.master}
          onOpenPreferences={noop}
          onStartHost={noop}
          onRefreshHost={noop}
          onLinkMaster={sample.linkFails ? rejected : resolved}
          onUnlinkMaster={resolved}
          onRefreshMaster={noop}
          onSavePin={resolved}
          onCopy={noop}
        />
      ))}
    </div>
  ),
});
