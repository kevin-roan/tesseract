import type { BrowserWindow } from "electron";
import { readConfig, type ConfigData } from "../../core/config";
import { discoverHealthySandbox, stackProject } from "../../core/connection";
import { effectiveEnv } from "../../core/docker";
import { createLogger } from "../../core/log";
import { decideFirstRun } from "../../core/onboarding";
import type { AppCommand } from "../../shared/contracts/app";
import { eventChannel } from "../../shared/ipc";
import { DEFAULT_PAGE, ROUTE, type OnboardingStepId, type PageId } from "../../shared/routes";
import type { LaunchAction } from "../app/deep-link";
import { mainContext } from "../context";
import { saveConnection } from "../ipc/connection";
import { createMainWindow, createOnboardingWindow, focusWindow, getWindow } from "../windows/manager";
import { deliverWhenReady } from "./idle";
import { completeOnboardingFromDiscovery } from "./onboarding";

const log = createLogger("first-run");

export async function adoptDiscoveredSandbox(data: ConfigData): Promise<boolean> {
  const { fixtures, isTest } = mainContext();
  if (fixtures || isTest) return false;
  const config = await discoverHealthySandbox({ env: effectiveEnv(), project: stackProject(data) ?? undefined });
  if (!config) return false;
  try {
    await saveConnection({ apiUrl: config.apiUrl, token: config.token, name: config.name, pairingUrl: config.pairingUrl });
    await completeOnboardingFromDiscovery();
  } catch (error) {
    log.warn(`could not save the discovered sandbox: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
  log.info(`using the running sandbox at ${config.apiUrl}`);
  return true;
}

export async function onboardingStepToResume(): Promise<OnboardingStepId | null> {
  const data = await readConfig(mainContext().configFile);
  const first = decideFirstRun(data, process.env);
  if (!first.open) return null;
  const decision = decideFirstRun(data, process.env, await adoptDiscoveredSandbox(data));
  return decision.open ? decision.step : null;
}

export async function openStartWindow(page: PageId = DEFAULT_PAGE, show = true): Promise<BrowserWindow> {
  const step = await onboardingStepToResume();
  if (step) return createOnboardingWindow(step);
  return createMainWindow(ROUTE.page(page), show);
}

export async function showApp(): Promise<BrowserWindow> {
  const existing = getWindow("main") ?? getWindow("onboarding");
  if (existing) {
    focusWindow(existing);
    return existing;
  }
  return openStartWindow();
}

export async function dispatchCommand(command: AppCommand): Promise<void> {
  const wizard = getWindow("onboarding");
  if (wizard && !getWindow("main")) {
    focusWindow(wizard);
    return;
  }
  const window = getWindow("main") ?? (await openStartWindow());
  focusWindow(window);
  if (window !== getWindow("main")) return;
  const contents = window.webContents;
  deliverWhenReady(contents, () => {
    if (!contents.isDestroyed()) contents.send(eventChannel("app", "command"), command);
  });
}

export async function runLaunchAction(action: LaunchAction): Promise<void> {
  if (action.kind === "show") await showApp();
  else if (action.kind === "onboarding") focusWindow(await createOnboardingWindow(action.step));
  else await dispatchCommand(action.command);
}
