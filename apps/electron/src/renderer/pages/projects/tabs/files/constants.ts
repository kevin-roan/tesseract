import type { IconName } from "../../../../theme/icons";

export const FOLDER_ICON: IconName = "folder";
export const LINK_ICON: IconName = "link";
export const UP_ICON: IconName = "back";
export const SAVE_ICON: IconName = "save";
export const SEND_ICON: IconName = "send";
export const HANDOFF_ICONS = { share: "share", open: "external" } as const satisfies Record<string, IconName>;
