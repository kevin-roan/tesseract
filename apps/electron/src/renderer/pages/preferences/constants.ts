export const PREFERENCES_SHEET = { width: 882, height: 622, viewportMargin: 32 } as const;

export const PREFERENCES_TOAST_SCOPE = "preferences";

export const PREFERENCES_TOAST_MS = { default: 5000, failure: 6000 } as const;

export const PAGE_SWITCH = { durationMs: 160, offsetY: 4 } as const;

export const NAV_KEYS = { previous: "ArrowUp", next: "ArrowDown", first: "Home", last: "End" } as const;

export const NAV_SELECTION_LAYOUT_ID = "preferences-nav-selection";

export const NAV_INITIAL_FOCUS = { selector: '[role="tab"][aria-selected="true"]' } as const;
