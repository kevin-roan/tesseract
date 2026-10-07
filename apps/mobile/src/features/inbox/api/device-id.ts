import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

import { APP_GROUP, PUSH_DEVICE_ID_FILE } from "../utils/constants";

let cached: string | null | undefined;

const newDeviceId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

function readOrCreate(): string | null {
  if (Platform.OS !== "ios") return null;
  const container = Paths.appleSharedContainers[APP_GROUP];
  if (!container) return null;
  const file = new File(container, PUSH_DEVICE_ID_FILE);
  if (file.exists) {
    const stored = file.textSync().trim();
    if (stored) return stored;
  }
  const id = newDeviceId();
  file.create({ overwrite: true });
  file.write(id);
  return id;
}

/**
 * Id of this phone, kept in the app group so the production app and the dev client share it.
 * The controller keeps one push token per id, so a phone with both installed gets each push once.
 * Android builds have no shared container: null.
 */
export function pushDeviceId(): string | null {
  if (cached !== undefined) return cached;
  try {
    cached = readOrCreate();
  } catch {
    cached = null;
  }
  return cached;
}
