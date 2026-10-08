import type { PickedFile } from "@/features/attachments/types";
import { fileNameOf, mimeTypeOr } from "@/features/attachments/utils/files";

import type { SharedItem } from "@/modules/tesseract-island";

import type { AttachDraft, CaptureImage, CaptureSeed } from "../types";

export type SplitSharedItems = {
  text: string | null;
  images: PickedFile[];
  files: PickedFile[];
};

const toPickedFile = (item: SharedItem, uri: string): PickedFile => ({
  uri,
  name: item.name || fileNameOf(uri, item.kind === "image" ? "shared-image.png" : "shared-file"),
  mimeType: mimeTypeOr(item.mimeType),
  sizeBytes: item.sizeBytes,
});

/** Text and links become draft text; images wait for the crop step; anything else attaches as-is. */
export function splitSharedItems(items: readonly SharedItem[]): SplitSharedItems {
  const lines: string[] = [];
  const images: PickedFile[] = [];
  const files: PickedFile[] = [];
  for (const item of items) {
    if ((item.kind === "text" || item.kind === "url") && item.text?.trim()) {
      lines.push(item.text.trim());
      continue;
    }
    if (!item.uri) continue;
    (item.kind === "image" ? images : files).push(toPickedFile(item, item.uri));
  }
  return { text: lines.length > 0 ? lines.join("\n") : null, images, files };
}

export function captureImageToFile(image: CaptureImage, mimeType: string): PickedFile {
  return { uri: image.uri, name: image.name, mimeType, sizeBytes: null };
}

export function mergeDraftText(current: string, incoming: string | null): string {
  if (!incoming) return current;
  if (!current.trim()) return incoming;
  return `${current.trimEnd()}\n${incoming}`;
}

/** Images need the crop step, so they become a capture seed; text and files can go straight to the attach sheet. */
export function seedFromSharedItems(items: readonly SharedItem[]): { seed: CaptureSeed } | { draft: AttachDraft } | null {
  const { text, images, files } = splitSharedItems(items);
  if (images.length > 0) return { seed: { images, text, files, source: "share" } };
  if (text || files.length > 0) return { draft: { text, files, source: "share" } };
  return null;
}
