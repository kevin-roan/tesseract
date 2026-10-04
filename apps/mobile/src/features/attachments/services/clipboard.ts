import { Clipboard } from "@/lib/clipboard";

import type { PickedFile } from "../types";
import { PNG_MIME_TYPE } from "../utils/constants";
import { base64FromDataUrl, decodedLength, pastedImageName } from "../utils/files";
import { writeCacheFile } from "./read-file";

export class EmptyClipboardError extends Error {}

export async function clipboardHasImage(): Promise<boolean> {
  if (!Clipboard) return false;
  try {
    return await Clipboard.hasImageAsync();
  } catch {
    return false;
  }
}

export function watchClipboard(listener: () => void): () => void {
  if (!Clipboard) return () => undefined;
  const subscription = Clipboard.addClipboardListener(listener);
  return () => subscription.remove();
}

export async function pasteFromClipboard(): Promise<PickedFile[]> {
  const image = Clipboard ? await Clipboard.getImageAsync({ format: "png" }) : null;
  if (!image) throw new EmptyClipboardError("There's no image on the clipboard to paste.");
  const data = base64FromDataUrl(image.data);
  const name = pastedImageName();
  return [{ uri: writeCacheFile(name, data), name, mimeType: PNG_MIME_TYPE, sizeBytes: decodedLength(data) }];
}

export async function clipboardText(): Promise<string | null> {
  if (!Clipboard) return null;
  try {
    const text = await Clipboard.getStringAsync();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}
