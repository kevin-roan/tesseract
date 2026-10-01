import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import type { PickedFile, PickerSource } from "../types";
import { IMAGE_MIME_TYPE, IMAGE_QUALITY } from "../utils/constants";
import { fileNameOf, mimeTypeOr } from "../utils/files";
import { pasteFromClipboard } from "./clipboard";

export class PermissionDeniedError extends Error {}

const fromImage = (asset: ImagePicker.ImagePickerAsset, index: number): PickedFile => ({
  uri: asset.uri,
  name: asset.fileName ?? fileNameOf(asset.uri, `photo-${index + 1}.jpg`),
  mimeType: mimeTypeOr(asset.mimeType ?? IMAGE_MIME_TYPE),
  sizeBytes: asset.fileSize ?? null,
});

const fromDocument = (asset: DocumentPicker.DocumentPickerAsset): PickedFile => ({
  uri: asset.uri,
  name: asset.name,
  mimeType: mimeTypeOr(asset.mimeType),
  sizeBytes: asset.size ?? null,
});

export async function pickFromLibrary(limit: number): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PermissionDeniedError("Allow photo access in Settings to attach photos.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: IMAGE_QUALITY,
  });
  return result.canceled ? [] : result.assets.map(fromImage);
}

export async function takePhoto(): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PermissionDeniedError("Allow camera access in Settings to take a photo.");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: IMAGE_QUALITY });
  return result.canceled ? [] : result.assets.map(fromImage);
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
  return result.canceled ? [] : result.assets.map(fromDocument);
}

export const PICKERS: Record<PickerSource, (limit: number) => Promise<PickedFile[]>> = {
  library: pickFromLibrary,
  camera: takePhoto,
  files: pickDocuments,
  clipboard: pasteFromClipboard,
};
