import { defineGalleryEntry } from "../../app/define";
import { PAIR_SAMPLES } from "./gallery-samples";
import { PairDialog } from "./PairDialog";

const noop = () => undefined;
const resolved = () => Promise.resolve();

export default defineGalleryEntry({
  id: "pair-dialog",
  title: "PairDialog",
  group: "Dialogs",
  render: () => (
    <PairDialog
      presentation="inline"
      onClose={noop}
      sandbox={PAIR_SAMPLES.sandbox}
      host={PAIR_SAMPLES.hostNoPin}
      onOpenPreferences={noop}
      onStartHost={noop}
      onRefreshHost={noop}
      onSavePin={resolved}
      onCopy={noop}
    />
  ),
});
