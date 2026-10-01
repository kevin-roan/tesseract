import type { UploadKind } from "@theone/protocol";
import {
  CameraIcon,
  ClipboardIcon,
  CropIcon,
  FileIcon,
  FilePdfIcon,
  ImageIcon,
  ImagesIcon,
  ShareNetworkIcon,
  WaveformIcon,
  type Icon,
} from "phosphor-react-native";

import type { MenuOption } from "@/components/menu-sheet/types";

import type { AttachSource, PickerSource } from "../types";

export const PICKER_SOURCES: readonly PickerSource[] = ["library", "camera", "files", "clipboard"];

export const SOURCE_LABELS: Record<AttachSource, string> = {
  library: "Photo library",
  camera: "Camera",
  files: "Files",
  clipboard: "Clipboard",
  capture: "Screen capture",
  share: "Shared",
};

export const SOURCE_ICONS: Record<AttachSource, Icon> = {
  library: ImagesIcon,
  camera: CameraIcon,
  files: FileIcon,
  clipboard: ClipboardIcon,
  capture: CropIcon,
  share: ShareNetworkIcon,
};

export const ATTACH_OPTIONS: MenuOption[] = [
  { id: "library", label: "Photo library", description: "Pick one or more photos", icon: ImagesIcon },
  { id: "camera", label: "Camera", description: "Take a photo", icon: CameraIcon },
  { id: "files", label: "Files", description: "PDFs, documents, logs and more", icon: FileIcon },
  { id: "clipboard", label: "Paste image", description: "Attach the image you copied", icon: ClipboardIcon },
];

export const KIND_ICONS: Record<UploadKind, Icon> = {
  image: ImageIcon,
  pdf: FilePdfIcon,
  audio: WaveformIcon,
  file: FileIcon,
};

export function isPickerSource(value: string): value is PickerSource {
  return (PICKER_SOURCES as readonly string[]).includes(value);
}
