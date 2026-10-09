import { APP_NAME, CLI_NAME } from "../shared/runtime";

export const TRAY_LABELS = {
  open: "Open Tesseract",
  hide: "Hide Window",
  refresh: "Refresh",
  pair: "Pair a device…",
  pairHost: "Pair this computer…",
  preferences: "Preferences",
  restartToUpdate: (version: string) => `Restart to Update to ${version}`,
  quit: "Quit Tesseract",
  tooltip: (status: string) => (status ? `${APP_NAME} · ${status}` : APP_NAME),
} as const;

export const MENU_LABELS = {
  about: "About Tesseract",
  preferences: "Preferences",
  installCli: `Install ‘${CLI_NAME}’ Command…`,
  checkForUpdates: "Check for Updates…",
  file: "File",
  newConversation: "New Conversation",
  pair: "Pair a device…",
  pairHost: "Pair this computer…",
  rediscover: "Rediscover Sandbox",
  closeWindow: "Close Window",
  edit: "Edit",
  view: "View",
  refresh: "Refresh",
  actualSize: "Actual Size",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  window: "Window",
  help: "Help",
  quit: "Quit",
} as const;

export const CLI_INSTALL_LABELS = {
  dev: `The ${CLI_NAME} command is only installed from a packaged build`,
  windows: `The installer adds the ${CLI_NAME} command to PATH`,
  windowsMissing: `Reinstall Tesseract to add the ${CLI_NAME} command to PATH`,
  translocated: `Move Tesseract to the Applications folder before installing the ${CLI_NAME} command`,
  conflict: (path: string) => `Another ${CLI_NAME} command is already installed at ${path}`,
  notOnPath: (dir: string) => `Add ${dir} to your PATH to run ${CLI_NAME} from a terminal`,
  outdated: `The installed ${CLI_NAME} command is from another version of Tesseract`,
  cancelled: "The installation was cancelled",
  failed: (reason: string) => `Couldn't install the ${CLI_NAME} command: ${reason}`,
} as const;

export const UPDATE_LABELS = {
  unsupportedDev: "Updates are only available in installed builds",
  unsupportedDisabled: "Updates are turned off for this build",
  unsupportedPackage: "Update Tesseract with your package manager",
  readyTitle: "Update ready",
  readyBody: (version: string) => `Tesseract ${version} installs when you quit.`,
  notReady: "No update has been downloaded yet",
} as const;

export const IPC_LABELS = {
  invalidUrl: "That link is not a valid URL",
  refusedProtocol: (protocol: string) => `Refusing to open ${protocol} links`,
  invalidPath: "That path is not an absolute file path",
  invalidSettings: "Settings must be an object",
  invalidNotification: "A notification needs a title",
  invalidTrayStatus: "The tray status must be text",
  invalidProjectId: "That is not a valid project id",
  invalidGitAction: "Pick pull, push or commit",
  invalidCommitMessage: "Write a commit message",
} as const;

export const WINDOW_LABELS = {
  main: APP_NAME,
  onboarding: `Set up ${APP_NAME}`,
} as const;

export const LOCAL_COMMAND_LABELS = {
  failed: (file: string, reason: string) => `error: couldn't run ${file}: ${reason}`,
} as const;
