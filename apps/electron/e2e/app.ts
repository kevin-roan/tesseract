import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { _electron, type ElectronApplication, type Page } from "playwright";
import { electronBinary, headlessSwitches, isolatedProfile, type IsolatedProfile } from "../scripts/lib/electron.ts";
import { APP_DIR } from "../scripts/lib/paths.ts";

export const E2E_WINDOW = { width: 1240, height: 800 } as const;
export const COMPLETED_ONBOARDING = { onboarding: { version: 1, step: "finish", statuses: {}, completedAt: "2026-10-06T00:00:00.000Z" } };

export interface LaunchedApp {
  app: ElectronApplication;
  window: Page;
  profile: IsolatedProfile;
  close(): Promise<void>;
}

export interface LaunchOptions {
  config?: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const profile = isolatedProfile(options.env);
  const configFile = profile.env.MONOLITH_DESKTOP_CONFIG ?? join(profile.dir, "config.json");
  mkdirSync(dirname(configFile), { recursive: true });
  writeFileSync(configFile, `${JSON.stringify(options.config ?? COMPLETED_ONBOARDING, null, 2)}\n`);
  const app = await _electron.launch({
    executablePath: electronBinary(),
    args: [...headlessSwitches(E2E_WINDOW.width, E2E_WINDOW.height), "--force-device-scale-factor=1", APP_DIR],
    env: profile.env as Record<string, string>,
  });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  return {
    app,
    window,
    profile,
    close: async () => {
      await app.close().catch(() => undefined);
      profile.dispose();
    },
  };
}
