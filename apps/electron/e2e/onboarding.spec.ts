import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { CHECK_TITLES } from "../src/core/docker/labels";
import { ANDROID_LABELS } from "../src/renderer/onboarding/android/labels";
import { DOCKER_LABELS } from "../src/renderer/onboarding/docker/labels";
import { DONE_LABELS } from "../src/renderer/onboarding/done/labels";
import { ONBOARDING_LABELS } from "../src/renderer/onboarding/labels";
import { SANDBOX_STEP_LABELS } from "../src/renderer/onboarding/sandbox/labels";
import { SHELL_LABELS } from "../src/renderer/shell/labels";
import { launchApp, type LaunchedApp } from "./app";
import {
  androidProfile,
  escapeRegExp,
  FIXTURE_ANDROID,
  freePort,
  liveStack,
  localDocker,
  readJson,
  readText,
  REAL_SERVICES_ENV,
  serveAndroidRepository,
  type AndroidProfile,
  type AndroidRepositoryFixture,
} from "./onboarding-helpers";

const BUTTONS = ONBOARDING_LABELS.buttons;
const SANDBOX = SANDBOX_STEP_LABELS;
const ANDROID = ANDROID_LABELS;
const FIXTURE_IMAGE = `system-images;android-${FIXTURE_ANDROID.api};google_apis;${FIXTURE_ANDROID.abi}`;

let launched: LaunchedApp | undefined;
const cleanups: (() => unknown)[] = [];

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function footer(window: Page) {
  return window.locator("footer");
}

async function gotoStep(page: Page, step: string): Promise<void> {
  await page.evaluate((target) => {
    globalThis.location.hash = `#/onboarding/${target}`;
  }, step);
  await expect(page).toHaveURL(new RegExp(`#/onboarding/${step}`));
}

test.describe("fresh profile", () => {
  test("lands on the welcome step of the setup wizard", async () => {
    launched = await launchApp({ config: {}, env: REAL_SERVICES_ENV });
    const { window } = launched;
    await expect(window).toHaveURL(/#\/onboarding\/welcome/);
    await expect(window.getByText(ONBOARDING_LABELS.titles.welcome).first()).toBeVisible();
    await expect(window.getByText("Requirements")).toBeVisible();
    await expect(window.getByText(/cores · (x64|arm64)/)).toBeVisible();
    for (const label of Object.values(ONBOARDING_LABELS.rail)) {
      if (label !== ONBOARDING_LABELS.rail.build) await expect(window.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await footer(window).getByRole("button", { name: BUTTONS.getStarted }).click();
    await expect(window).toHaveURL(/#\/onboarding\/docker/);
    await expect(window.getByText(DOCKER_LABELS.group)).toBeVisible();
  });
});

test.describe("docker step", () => {
  const docker = localDocker();
  test.skip(docker === null, "Docker isn't reachable on this computer");

  test("detects the local Docker engine and Compose", async () => {
    launched = await launchApp({ config: {}, env: REAL_SERVICES_ENV });
    const { window } = launched;
    await footer(window).getByRole("button", { name: BUTTONS.getStarted }).click();
    await expect(window).toHaveURL(/#\/onboarding\/docker/);
    await expect(window.getByText(CHECK_TITLES.compose, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(window.getByText(/^Running · \w+\/\w+/)).toBeVisible({ timeout: 30_000 });
    if (docker?.compose) await expect(window.getByText(new RegExp(escapeRegExp(docker.compose))).first()).toBeVisible();
    const proceed = footer(window).getByRole("button", { name: DOCKER_LABELS.buttons.continue });
    await expect(proceed).toBeEnabled({ timeout: 30_000 });
    await proceed.click();
    await expect(window).toHaveURL(/#\/onboarding\/claude/);
  });
});

test.describe("sandbox step (fixtures)", () => {
  test("shows the image components and runs a simulated build", async () => {
    launched = await launchApp({ config: {} });
    const { window } = launched;
    await expect(window).toHaveURL(/#\/onboarding\/welcome/);
    await gotoStep(window, "sandbox");
    await expect(window.getByText(SANDBOX.tools.title)).toBeVisible();
    await expect(window.getByText(SANDBOX.tools.base.title)).toBeVisible();
    for (const component of Object.values(SANDBOX.tools.components)) {
      await expect(window.getByRole("checkbox", { name: component.title }).first()).toBeVisible();
    }
    const flutter = window.getByRole("checkbox", { name: SANDBOX.tools.components.flutter.title }).first();
    const before = await flutter.getAttribute("aria-checked");
    await flutter.click();
    await expect(flutter).not.toHaveAttribute("aria-checked", before ?? "");

    await footer(window).getByRole("button", { name: SANDBOX.buttons.build }).click();
    const build = window.getByRole("region", { name: SANDBOX.build.title });
    await expect(build.getByText(SANDBOX.build.phase.building)).toBeVisible();
    await expect(footer(window).getByRole("button", { name: SANDBOX.buttons.cancel })).toBeVisible();
    await expect(build.getByText(SANDBOX.build.phase.done)).toBeVisible({ timeout: 30_000 });
    await footer(window).getByRole("button", { name: SANDBOX.buttons.continue }).click();
    await expect(window).toHaveURL(/#\/onboarding\/android/);
  });
});

test.describe("android step", () => {
  test.skip(process.platform !== "linux" || process.arch !== "x64", "the fixture repository ships a Linux x86_64 emulator");

  let repository: AndroidRepositoryFixture;
  let profile: AndroidProfile;

  test.beforeEach(async () => {
    repository = await serveAndroidRepository();
    profile = androidProfile(repository, await freePort());
    cleanups.push(() => repository.close(), () => profile.dispose());
  });

  test("lists packages from a local repository and creates an AVD in a temporary SDK", async () => {
    launched = await launchApp({ config: {}, env: { ...REAL_SERVICES_ENV, ...profile.env } });
    const { window } = launched;
    await expect(window).toHaveURL(/#\/onboarding\/welcome/);
    await gotoStep(window, "android");

    await expect(window.getByText(ANDROID.packages.title)).toBeVisible();
    const newest = window.getByRole("checkbox", { name: ANDROID.packages.select(ANDROID.imageName(FIXTURE_ANDROID.api, "16")) });
    const older = window.getByRole("checkbox", { name: ANDROID.packages.select(ANDROID.imageName(FIXTURE_ANDROID.olderApi, "15")) });
    await expect(newest).toBeVisible({ timeout: 30_000 });
    await expect(newest).toBeChecked();
    await expect(older).not.toBeChecked();
    await expect(window.getByText(ANDROID.packages.emulator, { exact: true })).toBeVisible();
    await expect(window.getByText(ANDROID.packages.platformTools, { exact: true })).toBeVisible();
    await expect(window.getByText(profile.sdkRoot).first()).toBeVisible();
    expect(repository.server.requests.map((request) => request.path)).toEqual(expect.arrayContaining(["/repository2-3.xml", "/sys-img2-3.xml"]));

    await window.getByRole("button", { name: ANDROID.avd.device }).click();
    await window.getByRole("option", { name: /^Pixel 8/ }).click();
    await window.getByRole("button", { name: ANDROID.avd.increase(ANDROID.avd.storage) }).click();

    await footer(window).getByRole("button", { name: ANDROID.buttons.install }).click();
    const licenses = window.getByRole("dialog", { name: ANDROID.licenses.title });
    await expect(licenses).toBeVisible();
    await expect(licenses.getByText(/fixture Android SDK License Agreement/)).toBeVisible();
    await licenses.getByRole("checkbox", { name: ANDROID.licenses.accept }).check();
    await licenses.getByRole("button", { name: ANDROID.licenses.acceptAndInstall }).click();

    const ready = window.getByRole("status").filter({ hasText: `${FIXTURE_ANDROID.avd} is ready` });
    await expect(ready).toBeVisible({ timeout: 60_000 });
    await expect(ready).toContainText(FIXTURE_ANDROID.abi);
    expect(repository.server.requests.map((request) => request.path)).toEqual(
      expect.arrayContaining(["/platform-tools.zip", "/emulator.zip", "/x86_64-36_r07.zip"]),
    );
    expect(repository.server.requests.map((request) => request.path)).not.toContain("/x86_64-35_r09.zip");

    const imageDir = join(profile.sdkRoot, "system-images", `android-${FIXTURE_ANDROID.api}`, "google_apis", FIXTURE_ANDROID.abi);
    expect(readText(join(imageDir, "system.img"))).toBe("system");
    expect(readText(join(imageDir, "package.xml"))).toContain(`path="${FIXTURE_IMAGE}"`);
    expect(existsSync(join(profile.sdkRoot, "emulator", "emulator"))).toBe(true);
    expect(existsSync(join(profile.sdkRoot, "licenses", FIXTURE_ANDROID.license))).toBe(true);
    expect(readText(join(profile.avdHome, `${FIXTURE_ANDROID.avd}.ini`))).toContain(`target=android-${FIXTURE_ANDROID.api}`);
    const avdConfig = readText(join(profile.avdHome, `${FIXTURE_ANDROID.avd}.avd`, "config.ini"));
    expect(avdConfig).toContain(`image.sysdir.1=system-images/android-${FIXTURE_ANDROID.api}/google_apis/${FIXTURE_ANDROID.abi}/`);
    expect(avdConfig).toContain(`abi.type=${FIXTURE_ANDROID.abi}`);
    for (const line of ["hw.device.name=pixel_8", "hw.lcd.width=1080", "hw.lcd.height=2400", "hw.lcd.density=420", "disk.dataPartition.size=7G"]) {
      expect(avdConfig).toContain(`${line}\n`);
    }
    const configFile = launched.profile.env.TESSERACT_DESKTOP_CONFIG as string;
    await expect.poll(() => readJson(configFile).androidAvd).toBe(FIXTURE_ANDROID.avd);
    expect(readJson(configFile).androidSdkRoot).toBeUndefined();

    await footer(window).getByRole("button", { name: ANDROID.buttons.continue }).click();
    await expect(window).toHaveURL(/#\/onboarding\/pair/);
  });
});

test.describe("finish", () => {
  test("opening Tesseract from the last step lands on the main shell and remembers it", async () => {
    launched = await launchApp({ config: {}, env: REAL_SERVICES_ENV });
    const { app, window: wizard } = launched;
    await expect(wizard).toHaveURL(/#\/onboarding\/welcome/);
    await gotoStep(wizard, "finish");
    await expect(wizard.getByText(ONBOARDING_LABELS.titles.finish).first()).toBeVisible();
    const autostart = wizard.getByRole("switch", { name: DONE_LABELS.autostart });
    await expect(autostart).toBeVisible();
    if (await autostart.isChecked()) await autostart.click();
    await expect(autostart).not.toBeChecked();

    const opened = app.waitForEvent("window");
    await footer(wizard).getByRole("button", { name: BUTTONS.openTesseract }).click();
    const main = await opened;
    await main.waitForLoadState("domcontentloaded");
    await expect(main).toHaveURL(/#\/overview/);
    await expect(main.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect.poll(() => wizard.isClosed()).toBe(true);

    const config = readJson<{ onboarding?: { completedAt?: string | null }; sandboxAutostart?: boolean }>(
      launched.profile.env.TESSERACT_DESKTOP_CONFIG as string,
    );
    expect(config.onboarding?.completedAt).toEqual(expect.any(String));
    expect(config.sandboxAutostart).toBe(false);
  });
});

test.describe("live stack", () => {
  const stack = liveStack();
  test.skip(stack === null, "TESSERACT_E2E_URL is not set (start the stack with infra/e2e)");

  test("a configured connection skips the wizard and the shell reaches the sandbox", async () => {
    launched = await launchApp({
      config: {},
      env: { ...REAL_SERVICES_ENV, TESSERACT_DESKTOP_URL: stack!.url, TESSERACT_TOKEN: stack!.token },
    });
    const { window } = launched;
    await expect(window).toHaveURL(/#\/overview/);
    await expect(window.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(window.getByText(SHELL_LABELS.projectStates.loading)).toHaveCount(0, { timeout: 30_000 });
    await expect(window.getByText(SHELL_LABELS.projectStates.offline)).toHaveCount(0);
  });
});
