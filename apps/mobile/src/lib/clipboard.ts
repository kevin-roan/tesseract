import { Platform } from "react-native";
import type * as ExpoClipboard from "expo-clipboard";

/** Loaded lazily: a dev client built before expo-clipboard was added throws on import. */
function loadClipboard(): typeof ExpoClipboard | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must be lazy, see above
    return require("expo-clipboard") as typeof ExpoClipboard;
  } catch {
    return null;
  }
}

export const Clipboard = loadClipboard();

export const COPY_FEEDBACK_MS = 1600;
