import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { DOWNLOADS_FOLDER, SHARING_UNAVAILABLE_MESSAGE } from "../utils/constants";

export type LocalFileRef = {
  folder: readonly string[];
  fileName: string;
  sizeBytes: number;
};

export type DownloadProgressHandler = (fraction: number | null) => void;

const localFile = (ref: LocalFileRef): File => new File(Paths.document, DOWNLOADS_FOLDER, ...ref.folder, ref.fileName);

export function isDownloaded(ref: LocalFileRef): boolean {
  try {
    const file = localFile(ref);
    return file.exists && file.size === ref.sizeBytes;
  } catch {
    return false;
  }
}

export async function downloadFile(url: string, ref: LocalFileRef, onProgress: DownloadProgressHandler): Promise<string> {
  const file = localFile(ref);
  file.parentDirectory.create({ intermediates: true, idempotent: true });
  if (file.exists) file.delete();
  const task = File.createDownloadTask(url, file, {
    onProgress: ({ bytesWritten, totalBytes }) => onProgress(totalBytes > 0 ? bytesWritten / totalBytes : null),
  });
  try {
    const downloaded = await task.downloadAsync();
    if (!downloaded) throw new Error("The download was interrupted.");
    return downloaded.uri;
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
}

export async function shareFile(ref: LocalFileRef): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(SHARING_UNAVAILABLE_MESSAGE);
  await Sharing.shareAsync(localFile(ref).uri, { dialogTitle: ref.fileName });
}
