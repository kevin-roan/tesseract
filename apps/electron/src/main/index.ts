import { homedir } from "node:os";
import { app, nativeTheme, powerMonitor } from "electron";
import { configBaseDir } from "../core/paths";
import { migrateLegacyConfigDir } from "../core/config";
import { applyPathFix } from "../core/docker";
import { createLogger, setLogLevel } from "../core/log";
import { APP_ID, DEEP_LINK_SCHEME, ENV } from "../shared/runtime";
import { DEFAULT_PAGE, ROUTE } from "../shared/routes";
import { installApplicationMenu } from "./app/application-menu";
import { parseLaunchArgs, type LaunchArgs } from "./app/args";
import { actionFromDeepLink, type LaunchAction } from "./app/deep-link";
import { markQuitting } from "./app/lifecycle";
import { localCommandInvocation, runLocalCommand } from "./app/local-command";
import { installSecurity } from "./app/security";
import { initContext, platform } from "./context";
import { registerIpc } from "./ipc/_framework/registry";
import { refreshCliSidecar } from "./services/cli-install";
import { startSandboxAutostart } from "./services/autostart";
import { onboardingStepToResume, runLaunchAction, showApp } from "./services/commands";
import { closeNotifications } from "./services/notifications";
import { loadSettings, onSettingsChanged, watchSettingsFile } from "./services/settings";
import { attachTray, detachTray, trayState } from "./services/tray";
import { startBackgroundUpdates } from "./services/updater";
import { captureSnapshot } from "./windows/snapshot";
import { SNAPSHOT_IDLE_TIMEOUT_MS } from "./windows/config";
import { applyWindowScheme, applyWindowZoom, createMainWindow, createOnboardingWindow } from "./windows/manager";

const log = createLogger("main");
const args = parseLaunchArgs(process.argv);
const isolated = args.snapshot !== null || process.env[ENV.snapshot] === "1";
const pending: LaunchAction[] = [];
let started = false;

function report(error: unknown): void {
  log.error(error instanceof Error ? error.message : String(error));
}

function handleAction(action: LaunchAction | null): void {
  if (!action) return;
  if (started) void runLaunchAction(action).catch(report);
  else pending.push(action);
}

function actionFromArgs(launch: LaunchArgs): LaunchAction | null {
  if (launch.deepLink) return actionFromDeepLink(launch.deepLink);
  if (launch.page) return { kind: "command", command: { type: "navigate", page: launch.page } };
  return null;
}

function handleSecondInstance(argv: readonly string[]): void {
  log.debug(`second instance: ${argv.slice(1).join(" ")}`);
  const next = parseLaunchArgs(argv);
  if (next.quit) {
    markQuitting();
    app.quit();
    return;
  }
  const action = actionFromArgs(next);
  if (action) handleAction(action);
  else if (started) void showApp().catch(report);
}

function registerProtocol(): void {
  if (!app.isPackaged) return;
  if (!app.isDefaultProtocolClient(DEEP_LINK_SCHEME)) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
}

async function openInitialWindow(launch: LaunchArgs): Promise<void> {
  const step = await onboardingStepToResume();
  if (step) {
    await createOnboardingWindow(step);
    return;
  }
  await createMainWindow(ROUTE.page(launch.page ?? DEFAULT_PAGE), !launch.hidden);
  if (launch.deepLink) handleAction(actionFromDeepLink(launch.deepLink));
}

function wireAppearance(): () => void {
  const stopSettings = onSettingsChanged((next, previous) => {
    if (next.appearance !== previous.appearance) applyWindowScheme();
    if (next.zoom !== previous.zoom) applyWindowZoom(next.zoom);
  });
  nativeTheme.on("updated", applyWindowScheme);
  return () => {
    stopSettings();
    nativeTheme.off("updated", applyWindowScheme);
  };
}

async function start(launch: LaunchArgs): Promise<void> {
  if (launch.debug) setLogLevel("debug");
  if (launch.quit && !isolated) {
    app.quit();
    return;
  }
  if (!isolated) {
    registerProtocol();
    app.on("second-instance", (_event, argv) => handleSecondInstance(argv));
  }

  await app.whenReady();
  const context = initContext(launch);
  installSecurity();
  await migrateLegacyConfigDir(configBaseDir(context.paths));
  await loadSettings();
  const stopAppearance = wireAppearance();
  const stopIpc = await registerIpc();
  installApplicationMenu();

  if (launch.snapshot) {
    try {
      await captureSnapshot({ ...launch.snapshot, timeoutMs: launch.snapshot.timeoutMs || SNAPSHOT_IDLE_TIMEOUT_MS });
      app.exit(0);
    } catch (error) {
      log.error(`snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
      app.exit(1);
    }
    return;
  }

  void refreshCliSidecar().catch(report);
  const stopWatch = watchSettingsFile();
  const stopUpdates = startBackgroundUpdates();
  app.on("before-quit", markQuitting);
  powerMonitor.on("shutdown", markQuitting);
  app.on("will-quit", () => {
    stopUpdates();
    stopWatch();
    stopAppearance();
    closeNotifications();
    detachTray();
    void stopIpc();
  });

  app.on("activate", () => {
    if (started) void showApp().catch(report);
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  await openInitialWindow(launch);
  void startSandboxAutostart()?.catch(report);
  if (!context.isTest) await attachTray();
  if (launch.hidden && !trayState().attached) await showApp();

  started = true;
  for (const action of pending.splice(0)) await runLaunchAction(action).catch(report);
}

function runLocal(command: string[]): void {
  app.dock?.hide();
  const invocation = localCommandInvocation(
    { platform: platform(), packaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath() },
    command,
  );
  void runLocalCommand(invocation).then(
    (code) => app.exit(code),
    (error: unknown) => {
      report(error);
      app.exit(1);
    },
  );
}

function boot(): void {
  const userData = process.env[ENV.userData];
  if (userData) app.setPath("userData", userData);
  if (args.snapshot) {
    app.commandLine.appendSwitch("force-device-scale-factor", "1");
    app.commandLine.appendSwitch("disable-gpu-vsync");
  }
  app.setAppUserModelId(APP_ID);
  const primary = isolated || app.requestSingleInstanceLock();
  if (!primary) {
    app.quit();
    return;
  }
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleAction(actionFromDeepLink(url));
  });
  start(args).catch((error: unknown) => {
    report(error);
    app.exit(1);
  });
}

process.env = applyPathFix(process.env, process.platform, homedir());
if (args.localCommand) runLocal(args.localCommand);
else boot();

