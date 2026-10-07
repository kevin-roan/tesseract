import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { encodeSnapshotArg, type SnapshotRequest } from "../src/shared/runtime.ts";
import { planCliInstall, type CliEnvironment, type CliProbe } from "../src/main/services/cli-plan.ts";
import { requiredCliFiles } from "../scripts/lib/dist-plan.ts";
import { headlessSwitches, isolatedProfile, type IsolatedProfile } from "../scripts/lib/electron.ts";
import { APP_DIR } from "../scripts/lib/paths.ts";
import { manifestMismatches, type SandboxManifest } from "../scripts/lib/sandbox-bundle.ts";
import { PACKAGED_FILES, parseCliVersion, parseUpdateFeed, pngSize, SMOKE_ROUTE, SMOKE_SIZE } from "../scripts/lib/smoke.ts";
import {
  appImagePath,
  appVersion,
  CLI_EXTRA_RESOURCE,
  describeRun,
  distMode,
  extractAppImage,
  EXTRACT_TIMEOUT_MS,
  DIST_TIMEOUT_MS,
  hasTool,
  isExecutable,
  LAUNCH_TIMEOUT_MS,
  NSIS_CLI_DIR,
  NSIS_PATH_MARKERS,
  QUIT_TIMEOUT_MS,
  quitEnv,
  readBuilderConfig,
  run,
  runDist,
  SANDBOX_EXTRA_RESOURCE,
  shouldBuild,
} from "./packaging-helpers.ts";

const config = readBuilderConfig();
const noLinks: CliProbe = { realpath: () => null, size: () => null };
const packagedEnv = (overrides: Partial<CliEnvironment>): CliEnvironment => ({
  platform: "linux",
  packaged: true,
  resourcesPath: "/opt/Monolith/resources",
  home: "/home/monolith",
  pathEnv: "",
  appImage: false,
  inApplicationsFolder: true,
  ...overrides,
});

test.describe("electron-builder config", () => {
  test("ships the CLI and the sandbox build context as extra resources on every OS", () => {
    const pairs = config.extraResources.map(({ from, to }) => ({ from, to }));
    expect(pairs).toContainEqual(CLI_EXTRA_RESOURCE);
    expect(pairs).toContainEqual(SANDBOX_EXTRA_RESOURCE);
    expect(config.asar).toBe(true);
    expect(requiredCliFiles("mac")).toEqual([
      "dist-cli/mac-x64/monolith",
      "dist-cli/mac-x64/theone-controller",
      "dist-cli/mac-arm64/monolith",
      "dist-cli/mac-arm64/theone-controller",
    ]);
    expect(requiredCliFiles("win")).toEqual(["dist-cli/win-x64/monolith.exe", "dist-cli/win-x64/theone-controller.exe"]);
    expect(requiredCliFiles("linux")).toEqual(["dist-cli/linux-x64/monolith", "dist-cli/linux-x64/theone-controller"]);
  });

  test("declares a universal macOS dmg with an Applications link and in-app CLI install", () => {
    expect(config.mac.target).toContainEqual({ target: "dmg", arch: ["universal"] });
    expect(config.mac.hardenedRuntime).toBe(true);
    expect(config.dmg.contents).toContainEqual(expect.objectContaining({ type: "link", path: "/Applications" }));
    const plan = planCliInstall(packagedEnv({ platform: "darwin", resourcesPath: "/Applications/Monolith.app/Contents/Resources" }), noLinks);
    expect(plan.method).toBe("admin-symlink");
    expect(plan.status).toMatchObject({
      state: "missing",
      binaryPath: "/Applications/Monolith.app/Contents/Resources/bin/monolith",
      linkPath: "/usr/local/bin/monolith",
    });
  });

  test("declares a per-user Windows NSIS installer that puts resources\\bin on the user PATH", () => {
    expect(config.win.target).toContainEqual({ target: "nsis", arch: ["x64"] });
    expect(config.nsis).toMatchObject({ oneClick: true, perMachine: false, allowElevation: false, include: "build/installer.nsh" });
    const script = readFileSync(join(APP_DIR, config.nsis.include), "utf8");
    for (const marker of NSIS_PATH_MARKERS) expect(script).toContain(marker);
    const resources = "C:\\Users\\me\\AppData\\Local\\Programs\\Monolith\\resources";
    const installed = planCliInstall(packagedEnv({ platform: "win32", resourcesPath: resources, pathEnv: `C:\\Windows;${resources}\\bin` }), noLinks);
    expect(installed.status).toMatchObject({ state: "installed", binaryPath: `${resources}\\bin\\monolith.exe` });
    const missing = planCliInstall(packagedEnv({ platform: "win32", resourcesPath: resources, pathEnv: "C:\\Windows" }), noLinks);
    expect(missing.status.state).toBe("unsupported");
    expect(NSIS_CLI_DIR.endsWith("resources\\bin")).toBe(true);
  });

  test("declares the Linux AppImage and deb with CLI links", () => {
    expect(config.linux.target.map(({ target }) => target)).toEqual(expect.arrayContaining(["AppImage", "deb"]));
    const postinst = readFileSync(join(APP_DIR, config.deb.afterInstall), "utf8");
    expect(postinst).toContain("CLI_LINK=/usr/bin/monolith");
    expect(readFileSync(join(APP_DIR, config.deb.afterRemove), "utf8")).toContain('rm -f "$CLI_LINK"');
    const appImage = planCliInstall(packagedEnv({ appImage: true, resourcesPath: "/tmp/.mount_Monolith/resources" }), noLinks);
    expect(appImage.method).toBe("copy");
    expect(appImage.copyPath).toBe("/home/monolith/.local/share/monolith/bin/monolith");
    expect(appImage.status.linkPath).toBe("/home/monolith/.local/bin/monolith");
  });

  test("NSIS PATH macros add and remove the CLI directory under makensis + wine", () => {
    test.skip(process.platform !== "linux" || !hasTool("wine"), "needs a Linux host with wine");
    test.setTimeout(EXTRACT_TIMEOUT_MS);
    const result = run(process.execPath, ["scripts/check-nsis-path.ts"], { cwd: APP_DIR, timeout: EXTRACT_TIMEOUT_MS });
    test.skip(result.status === 2, "electron-builder has not downloaded NSIS yet");
    expect(result.status, describeRun(result)).toBe(0);
  });
});

test.describe("Linux AppImage", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(process.platform !== "linux" || process.arch !== "x64", "the AppImage is built on linux-x64 hosts");

  const version = appVersion();
  const appImage = appImagePath(version);
  let profile: IsolatedProfile | null = null;
  let root = "";

  test.beforeAll(() => {
    test.setTimeout(DIST_TIMEOUT_MS + EXTRACT_TIMEOUT_MS);
    const mode = distMode();
    if (shouldBuild(mode, appImage)) {
      const result = runDist();
      if (result.status !== 0) throw new Error(`dist failed: ${describeRun(result)}`);
    }
    test.skip(!existsSync(appImage), `no AppImage at ${appImage} (MONOLITH_E2E_DIST=never)`);
    profile = isolatedProfile();
    const extracted = extractAppImage(appImage, profile.dir, profile.env);
    if (!extracted) throw new Error(`could not extract ${appImage}`);
    root = extracted;
  });

  test.afterAll(() => {
    profile?.dispose();
    profile = null;
  });

  test("contains the app, the CLI binaries and the sandbox build context", () => {
    for (const file of PACKAGED_FILES) {
      const path = join(root, file.path);
      expect(existsSync(path), file.path).toBe(true);
      if (file.executable) expect(isExecutable(path), `${file.path} is executable`).toBe(true);
    }
    const sandbox = join(root, "resources/sandbox");
    const manifest = JSON.parse(readFileSync(join(sandbox, "manifest.json"), "utf8")) as SandboxManifest;
    expect(Object.keys(manifest.files).length).toBeGreaterThan(0);
    const drift = manifestMismatches(manifest, (file) => {
      const path = join(sandbox, file);
      return existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null;
    });
    expect(drift).toEqual([]);
    const feed = parseUpdateFeed(readFileSync(join(root, "resources/app-update.yml"), "utf8"));
    expect(feed.provider).toBe("generic");
  });

  test("bundled monolith CLI reports the app version", () => {
    const result = run(join(root, "resources/bin/monolith"), ["--version"], { env: profile?.env, timeout: QUIT_TIMEOUT_MS });
    expect(result.status, describeRun(result)).toBe(0);
    expect(parseCliVersion(result.stdout)).toBe(version);
  });

  test("packaged app starts and exits with --quit", () => {
    const env = quitEnv(profile?.env ?? process.env);
    const started = Date.now();
    const result = run(join(root, "AppRun"), [...headlessSwitches(SMOKE_SIZE.width, SMOKE_SIZE.height), "--quit"], { env, timeout: QUIT_TIMEOUT_MS });
    expect(result.status, describeRun(result)).toBe(0);
    expect(Date.now() - started).toBeLessThan(QUIT_TIMEOUT_MS);
  });

  test("packaged app renders the setup wizard and exits", () => {
    test.setTimeout(LAUNCH_TIMEOUT_MS + 10_000);
    const request: SnapshotRequest = {
      route: SMOKE_ROUTE,
      out: join(profile?.dir ?? APP_DIR, "packaging-smoke.png"),
      width: SMOKE_SIZE.width,
      height: SMOKE_SIZE.height,
      appearance: "dark",
      timeoutMs: LAUNCH_TIMEOUT_MS / 2,
    };
    const args = [...headlessSwitches(request.width, request.height), encodeSnapshotArg(request)];
    const result = run(join(root, "AppRun"), args, { env: profile?.env, timeout: LAUNCH_TIMEOUT_MS });
    expect(result.status, describeRun(result)).toBe(0);
    expect(existsSync(request.out)).toBe(true);
    expect(pngSize(readFileSync(request.out))).toEqual({ width: request.width, height: request.height });
  });
});
