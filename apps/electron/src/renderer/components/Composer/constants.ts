import { transition } from "../../theme/motion";
import type { AttachKind } from "./model";

export const COMPOSER_SIZE = {
  minHeight: 24,
  maxHeight: 240,
  largeMinHeight: 72,
  largeMaxHeight: 320,
  followUpMaxHeight: 200,
} as const;

export const SEND_ICON_SIZE = 16;
export const SEND_SPINNER_SIZE = 14;
export const ATTACH_BUTTON_SIZE = { standard: 28, large: 32 } as const;
export const SLASH_HINT_LIMIT = 8;

export const ATTACH_MENU: readonly { id: AttachKind; label: "files" | "images" | "paste"; icon: "files" | "images" | "paste" }[] = [
  { id: "files", label: "files", icon: "files" },
  { id: "images", label: "images", icon: "images" },
  { id: "paste", label: "paste", icon: "paste" },
];

export const ATTACHMENT_KIND_ICONS = { image: "image", pdf: "file-pdf", audio: "audio", file: "file" } as const;
export const ATTACHMENT_NAME_CHARS = 22;
export const ATTACHMENT_EXIT = { opacity: 0, scale: 0.96, transition: transition.exit };
