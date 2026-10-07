import { defineGalleryEntry } from "../../app/define";
import { PAIR_SAMPLES } from "./gallery-samples";
import { PairDialog } from "./PairDialog";

const noop = () => undefined;
const resolved = () => Promise.resolve();

export default defineGalleryEntry({
  id: "pair-dialog-host",
  title: "PairDialog (This computer)",
  group: "Dialogs",
  render: () => (
    <PairDialog
      presentation="inline"
      initialTarget="host"
      onClose={noop}
      sandbox={PAIR_SAMPLES.unconfigured}
      host={PAIR_SAMPLES.hostNoPin}
      onOpenPreferences={noop}
      onStartHost={noop}
      onRefreshHost={noop}
      onSavePin={resolved}
      onCopy={noop}
    />
  ),
});
