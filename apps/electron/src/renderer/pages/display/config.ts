import { KEY_COMBO_ORDER, type KeyComboId } from "../../features/display/constants";
import { DISPLAY_LABELS, KEY_LABELS } from "../../features/display/labels";

export const SCALE_OPTIONS = [
  { id: "fit", fit: true, label: DISPLAY_LABELS.scaleFit, tooltip: DISPLAY_LABELS.scaleFitTooltip },
  { id: "one", fit: false, label: DISPLAY_LABELS.scaleOne, tooltip: DISPLAY_LABELS.scaleOneTooltip },
] as const;

export const KEY_ITEMS: readonly { id: KeyComboId; label: string }[] = KEY_COMBO_ORDER.map((id) => ({ id, label: KEY_LABELS[id] }));

export const MENU_MIN_WIDTH = 200;
export const PREVIEW_SPINNER_SIZE = 24;
export const OVERLAY_SPINNER_SIZE = 24;
