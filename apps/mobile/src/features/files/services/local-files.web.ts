import { Linking } from "react-native";

import type { DownloadProgressHandler, LocalFileRef } from "./local-files";

export type { DownloadProgressHandler, LocalFileRef } from "./local-files";

export const isDownloaded = (_ref: LocalFileRef): boolean => false;

export async function downloadFile(url: string, _ref: LocalFileRef, _onProgress: DownloadProgressHandler): Promise<string> {
  await Linking.openURL(url);
  return url;
}

export async function shareFile(_ref: LocalFileRef): Promise<void> {}

export function removeLocalFile(_ref: LocalFileRef): void {}
