import { basename } from "node:path";
import { clipboard, dialog, nativeImage } from "electron";
import {
  ATTACHMENT_LABELS,
  AttachmentError,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_PREFIX,
  PNG_MIME_TYPE,
  TEXT_MIME_TYPE,
  pasteFailedMessage,
  pastedImage,
  pickedFile,
  readAttachment,
} from "../../core/attachments";
import type { AttachmentFileData, AttachmentPickKind } from "../../shared/contracts/attachments";
import { IpcError } from "../../shared/ipc-types";
import { defineService } from "./_framework/define";

const DIALOG = {
  images: { title: ATTACHMENT_LABELS.imagesTitle, filter: ATTACHMENT_LABELS.imagesFilter },
  files: { title: ATTACHMENT_LABELS.filesTitle, filter: null },
} as const satisfies Record<AttachmentPickKind, { title: string; filter: string | null }>;

interface LegacyClipboard {
  availableFormats?(): string[];
  readImage?(): Electron.NativeImage;
}

const legacy = clipboard as unknown as LegacyClipboard;
const pickedPaths = new Set<string>();

async function clipboardTypes(): Promise<string[]> {
  if (typeof clipboard.read === "function") {
    try {
      return (await clipboard.read()).flatMap((item) => item.types);
    } catch {
      return legacy.availableFormats?.() ?? [];
    }
  }
  return legacy.availableFormats?.() ?? [];
}

async function hasImage(): Promise<boolean> {
  return (await clipboardTypes()).some((type) => type.startsWith(IMAGE_MIME_PREFIX));
}

async function readClipboardPng(): Promise<Uint8Array | null> {
  if (typeof clipboard.read === "function") {
    for (const item of await clipboard.read()) {
      const type = item.types.includes(PNG_MIME_TYPE) ? PNG_MIME_TYPE : item.types.find((candidate) => candidate.startsWith(IMAGE_MIME_PREFIX));
      if (!type) continue;
      const blob = (await item.getType(type)) as Blob;
      const data = Buffer.from(await blob.arrayBuffer());
      if (type === PNG_MIME_TYPE) return data;
      const image = nativeImage.createFromBuffer(data);
      return image.isEmpty() ? null : image.toPNG();
    }
    return null;
  }
  const image = legacy.readImage?.();
  return image && !image.isEmpty() ? image.toPNG() : null;
}

async function pasteImage(): Promise<AttachmentFileData | null> {
  let png: Uint8Array | null;
  try {
    png = await readClipboardPng();
  } catch (error) {
    throw new IpcError("internal", pasteFailedMessage(error));
  }
  if (!png || png.length === 0) return null;
  try {
    return pastedImage(png);
  } catch (error) {
    throw new IpcError("invalid_argument", error instanceof Error ? error.message : String(error));
  }
}

export default defineService("attachments", {
  pick: async (context, kind) => {
    const config = DIALOG[kind];
    const options: Electron.OpenDialogOptions = {
      title: config.title,
      properties: ["openFile", "multiSelections"],
      filters: config.filter ? [{ name: config.filter, extensions: [...IMAGE_EXTENSIONS] }] : undefined,
    };
    const result = context.window ? await dialog.showOpenDialog(context.window, options) : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    pickedPaths.clear();
    for (const path of result.filePaths) pickedPaths.add(path);
    return Promise.all(result.filePaths.map((path) => pickedFile(path)));
  },
  read: async (_context, path) => {
    if (typeof path !== "string" || !path) throw new IpcError("invalid_argument", ATTACHMENT_LABELS.noPath(String(path ?? "")));
    if (!pickedPaths.delete(path)) throw new IpcError("forbidden", ATTACHMENT_LABELS.notPicked(basename(path)));
    try {
      return await readAttachment(path);
    } catch (error) {
      if (error instanceof AttachmentError) throw new IpcError("invalid_argument", error.message);
      throw error;
    }
  },
  clipboardHasImage: () => hasImage(),
  clipboardHasText: async () => {
    if (typeof clipboard.has === "function") return clipboard.has(TEXT_MIME_TYPE).catch(async () => (await clipboardTypes()).includes(TEXT_MIME_TYPE));
    return (await clipboardTypes()).includes(TEXT_MIME_TYPE);
  },
  pasteImage: () => pasteImage(),
});
