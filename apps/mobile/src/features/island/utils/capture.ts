import type { CapturedImage } from "@/modules/tesseract-island";

import type { CaptureImage, CaptureOption, CaptureSource } from "../types";

const OPTIONS: Record<CaptureSource, Omit<CaptureOption, "id">> = {
  app: { label: "This screen", description: "Snapshot of the app as it is now" },
  screen: { label: "Whole screen", description: "Everything on the display, including other apps" },
  library: { label: "Latest screenshot", description: "Pick a screenshot from your photos" },
  clipboard: { label: "Clipboard", description: "The image or text you copied last" },
};

export function captureOptions(canCaptureWholeScreen: boolean): CaptureOption[] {
  const sources: CaptureSource[] = canCaptureWholeScreen ? ["app", "screen", "library", "clipboard"] : ["app", "library", "clipboard"];
  return sources.map((id) => ({ id, ...OPTIONS[id] }));
}

export function captureFileName(prefix = "capture"): string {
  return `${prefix}-${Date.now().toString(36)}.png`;
}

export function captureImageFrom(captured: CapturedImage, name: string = captureFileName()): CaptureImage {
  return { uri: captured.uri, width: captured.width, height: captured.height, name };
}
