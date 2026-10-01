import { Image } from "react-native";

import type { PickedFile } from "@/features/attachments/types";

import type { CaptureImage } from "../types";

export async function captureImageFromFile(file: PickedFile): Promise<CaptureImage | null> {
  try {
    const { width, height } = await Image.getSize(file.uri);
    return width > 0 && height > 0 ? { uri: file.uri, width, height, name: file.name } : null;
  } catch {
    return null;
  }
}
