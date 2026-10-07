export const DISPLAY_LABELS = {
  title: "Display",
  toolbarLabel: "Display controls",
  scaleLabel: "Scale",
  scaleFit: "Fit",
  scaleOne: "1:1",
  scaleFitTooltip: "Scale the display to the window",
  scaleOneTooltip: "Show the display pixel for pixel",
  windows: "Open windows",
  viewOnly: "View only (ignore mouse and keyboard)",
  clipboard: "Sync clipboard with the sandbox",
  sendKeys: "Send keys",
  screenshot: "Save a screenshot",
  browser: "Open in browser (noVNC)",
  reconnect: "Reconnect",
  fullscreen: "Fullscreen (F11)",
  exitFullscreen: "Exit fullscreen (F11)",
  more: "More actions",
  menuViewOnly: "View only",
  menuClipboard: "Sync clipboard",
  menuSendKeys: "Send keys",
  menuScreenshot: "Save screenshot…",
  menuBrowser: "Open in browser",
  stageLabel: "Sandbox display",
  remoteFrame: "Screenshot of the sandbox display",
} as const;

export const BADGE_LABELS = {
  offline: "Offline",
  loading: "Checking",
  error: "Unreachable",
  no_display: "No display",
  preview: "Screenshots only",
  idle: "Idle",
  connecting: "Connecting",
  authenticating: "Authenticating",
  connected: "Live",
  retrying: "Reconnecting",
  auth_failed: "Password rejected",
  unavailable: "VNC unavailable",
  failed: "Disconnected",
} as const;

export const KEY_LABELS = {
  "ctrl-alt-delete": "Ctrl+Alt+Delete",
  "ctrl-alt-backspace": "Ctrl+Alt+Backspace",
  "alt-tab": "Alt+Tab",
  "alt-f4": "Alt+F4",
  super: "Super",
  escape: "Escape",
  print: "Print Screen",
} as const;

export const OVERLAY_LABELS = {
  idleTitle: "Starting viewer…",
  connectingTitle: "Connecting to the display…",
  connectingMessage: "Opening the VNC bridge through the controller.",
  authenticatingTitle: "Authenticating…",
  authenticatingMessage: "Sending the VNC password.",
  retryingTitle: "Connection lost",
  retryingMessage: (error: string, seconds: number, attempt: number) =>
    `${error}Reconnecting in ${seconds}s (attempt ${attempt}).`,
  retryingAction: "Reconnect now",
  authFailedTitle: "VNC password rejected",
  authFailedMessage: (error: string) => `${error}The sandbox may have been restarted with a new password.`,
  authFailedAction: "Try again",
  failedTitle: "Viewer stopped",
  failedAction: "Reconnect",
  unavailableTitle: "VNC is not answering",
  unavailableAction: "Check again",
} as const;

export const EMPTY_LABELS = {
  offlineTitle: "Sandbox unreachable",
  retry: "Retry",
  loadingTitle: "Checking the display…",
  loadingMessage: "Asking the controller about the virtual display.",
  errorTitle: "Couldn't reach the display",
  tryAgain: "Try again",
  noDisplayTitle: "The display is not running",
  noDisplayMessage: (display: string) =>
    `Xvnc on ${display} is down, so there is nothing to show. It restarts automatically; check again in a moment.`,
  checkAgain: "Check again",
} as const;

export const PREVIEW_LABELS = {
  title: "VNC is not answering",
  message: "The display is up but its VNC server is not. Showing a screenshot every 3s until it is back.",
  action: "Check again",
  loading: "Taking a screenshot…",
} as const;

export const WINDOWS_LABELS = {
  title: "Open windows",
  refresh: "Refresh",
  loading: "Reading the sandbox's windows…",
  emptyTitle: "No windows open",
  emptyMessage: "Nothing is showing on the sandbox display.",
  errorTitle: "Couldn't list the windows",
  untitled: "Untitled window",
  active: "Active",
  minimized: "Minimized",
  close: "Close window",
  forceQuit: "Force quit",
  confirmHeading: "Force quit this app?",
  confirmBody: "Its process is killed without a chance to save. Use this when the window doesn't respond to Close.",
  confirmCancel: "Cancel",
  confirmAction: "Force quit",
} as const;

export const SESSION_ERRORS = {
  needsPassword: "the server needs a VNC password",
  authFailed: "authentication failed",
  socketFailed: "The VNC bridge closed the connection",
} as const;

export const TOAST_LABELS = {
  windowActionFailed: (error: string) => `Window action failed: ${error}`,
  screenshotSaved: (name: string) => `Screenshot saved to ${name}`,
  screenshotFailed: (error: string) => `Screenshot failed: ${error}`,
  browserFailed: (error: string) => `Couldn't open the browser: ${error}`,
  clipboardReceived: "Clipboard received from the sandbox",
} as const;
