import { showToast, useToastStore } from "../../components/Toast";
import { SHORTCUT_LABELS } from "./labels";

const EPSILON = 1e-6;

let lastZoom: number | null = null;
let toastId: number | null = null;

export function rememberZoom(zoom: number): void {
  lastZoom ??= zoom;
}

export function announceZoom(zoom: number, force = false): void {
  const changed = lastZoom !== null && Math.abs(lastZoom - zoom) > EPSILON;
  lastZoom = zoom;
  if (!force && !changed) return;
  if (toastId !== null) useToastStore.getState().dismiss(toastId);
  toastId = showToast(SHORTCUT_LABELS.zoomToast(Math.round(zoom * 100)));
}

export function resetZoomFeedback(): void {
  lastZoom = null;
  toastId = null;
}
