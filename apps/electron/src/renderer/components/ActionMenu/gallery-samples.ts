export const ACTION_MENU_GALLERY = {
  target: "Right-click, Shift+F10 or long-press here",
  more: "More actions",
  menuLabel: "Conversation actions",
  rename: "Rename…",
  pin: "Pin",
  copyLink: "Copy link",
  archive: "Archive",
  delete: "Delete",
} as const;

export const noop = (): void => undefined;
