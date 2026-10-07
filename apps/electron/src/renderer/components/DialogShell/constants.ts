export const DIALOG_WIDTH = 520;
export const DIALOG_BORDER_PX = 1;

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export const AUTO_FOCUS_SELECTOR = "[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])";
export const DEFAULT_SELECTOR = "[data-dialog-default]:not(:disabled):not([aria-disabled='true'])";
export const CANCEL_SELECTOR = "[data-dialog-cancel]";
