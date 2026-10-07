import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSnapshotArg, type SnapshotRequest } from "../src/shared/runtime.ts";
import { parseArgs } from "./lib/args.ts";
import { headlessSwitches, isolatedProfile } from "./lib/electron.ts";
import { APP_DIR, resolveOutput } from "./lib/paths.ts";
import { manifestMismatches, type SandboxManifest } from "./lib/sandbox-bundle.ts";
import {
  artifactName,
  DEB_FILES,
  DEB_POSTINST_MARKERS,
  DESKTOP_ENTRY,
  DESKTOP_ENTRY_LINES,
  PACKAGED_FILES,
  parseCliVersion,
  parseUpdateFeed,
  pngSize,
  SMOKE_ROUTE,
  SMOKE_SIZE,
  SMOKE_TIMEOUT_MS,
} from "./lib/smoke.ts";

const USAGE = "usage: node scripts/smoke.ts [--appimage <file>] [--deb <file>] [--snapshot-out <file.png>] [--no-launch]";

function version(): string {
  return (JSON.parse(readFileSync(join(APP_DIR, "package.json"), "utf8")) as { version: string }).version;
}

function run(file: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {}): SpawnSyncReturns<string> {
  return spawnSync(file, args, { encoding: "utf8", timeout: options.timeout ?? SMOKE_TIMEOUT_MS, ...options });
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  console.log(`ok  ${message}`);
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function inspectPackagedTree(root: string, expectedVersion: string): void {
  for (const file of PACKAGED_FILES) {
    const path = join(root, file.path);
    check(existsSync(path) && (!file.executable || isExecutable(path)), `${file.path}${file.executable ? " (executable)" : ""}`);
  }
  const sandbox = join(root, "resources/sandbox");
  const manifest = JSON.parse(readFileSync(join(sandbox, "manifest.json"), "utf8")) as SandboxManifest;
  const drift = manifestMismatches(manifest, (file) => {
    const path = join(sandbox, file);
    return existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null;
  });
  check(drift.length === 0, `sandbox context matches manifest.json (${Object.keys(manifest.files).length} files)${drift.length ? `: ${drift.join(", ")}` : ""}`);
  const feed = parseUpdateFeed(readFileSync(join(root, "resources/app-update.yml"), "utf8"));
  check(feed.provider === "generic" && feed.url?.startsWith("http"), `update feed ${feed.provider} ${feed.url}`);
  const cli = run(join(root, "resources/bin/tesseract"), ["--version"]);
  check(parseCliVersion(cli.stdout) === expectedVersion, `tesseract --version = ${cli.stdout.trim() || cli.stderr.trim()}`);
}

function launchSnapshot(executable: string, out: string, env: NodeJS.ProcessEnv): void {
  const request: SnapshotRequest = {
    route: SMOKE_ROUTE,
    out,
    width: SMOKE_SIZE.width,
    height: SMOKE_SIZE.height,
    appearance: "dark",
    timeoutMs: SMOKE_TIMEOUT_MS / 2,
  };
  const result = run(executable, [...headlessSwitches(request.width, request.height), encodeSnapshotArg(request)], { env, timeout: SMOKE_TIMEOUT_MS });
  if (result.status !== 0) process.stderr.write(`${result.stdout}\n${result.stderr}\n`);
  check(result.status === 0, `app started and rendered ${SMOKE_ROUTE} (exit ${result.status ?? result.signal})`);
  const size = existsSync(request.out) ? pngSize(readFileSync(request.out)) : null;
  check(size?.width === request.width && size.height === request.height, `snapshot ${size?.width}x${size?.height}`);
}

function smokeAppImage(appImage: string, expectedVersion: string, launch: boolean, snapshotOut: string | null): void {
  const profile = isolatedProfile();
  try {
    const extract = run(appImage, ["--appimage-extract"], { cwd: profile.dir, env: profile.env, timeout: 300_000 });
    const root = join(profile.dir, "squashfs-root");
    check(extract.status === 0 && existsSync(root), `extracted ${appImage}`);
    inspectPackagedTree(root, expectedVersion);
    if (!launch) return;
    const direct = run(appImage, ["--appimage-version"], { env: profile.env });
    const executable = direct.status === 0 ? appImage : join(root, "AppRun");
    launchSnapshot(executable, snapshotOut ?? join(profile.dir, "smoke.png"), profile.env);
  } finally {
    profile.dispose();
  }
}

function smokeDeb(deb: string): void {
  const profile = isolatedProfile();
  try {
    check(run("ar", ["x", deb], { cwd: profile.dir }).status === 0, `unpacked ${deb}`);
    const members = readdirSync(profile.dir);
    const data = members.find((name) => name.startsWith("data.tar"));
    const control = members.find((name) => name.startsWith("control.tar"));
    check(data && control, "deb has control and data archives");
    const dataDir = join(profile.dir, "data");
    const controlDir = join(profile.dir, "control");
    for (const [archive, target] of [[data, dataDir], [control, controlDir]] as const) {
      mkdirSync(target, { recursive: true });
      check(run("tar", ["-xf", join(profile.dir, archive), "-C", target]).status === 0, `extracted ${archive}`);
    }
    for (const file of DEB_FILES) check(existsSync(join(dataDir, file)), file);
    const postinst = readFileSync(join(controlDir, "postinst"), "utf8");
    for (const marker of DEB_POSTINST_MARKERS) check(postinst.includes(marker), `postinst has ${marker}`);
    const desktop = readFileSync(join(dataDir, DESKTOP_ENTRY), "utf8").split("\n");
    for (const line of DESKTOP_ENTRY_LINES) check(desktop.includes(line), `desktop entry has ${line}`);
    check(!postinst.includes("${"), "postinst has no unexpanded template variables");
  } finally {
    profile.dispose();
  }
}

function main(): number {
  const args = parseArgs(process.argv.slice(2), ["appimage", "deb", "snapshot-out"]);
  if (args.flags.has("help")) {
    console.log(USAGE);
    return 0;
  }
  const expectedVersion = version();
  const appImage = args.values.get("appimage") ?? join(APP_DIR, "dist", artifactName(expectedVersion, "AppImage"));
  const deb = args.values.get("deb") ?? join(APP_DIR, "dist", artifactName(expectedVersion, "deb"));
  try {
    check(existsSync(appImage), `found ${appImage}`);
    const snapshotOut = args.values.get("snapshot-out");
    smokeAppImage(appImage, expectedVersion, !args.flags.has("no-launch"), snapshotOut ? resolveOutput(snapshotOut) : null);
    if (existsSync(deb)) smokeDeb(deb);
    else console.log(`skip ${deb} (not built)`);
    console.log("smoke passed");
    return 0;
  } catch (error) {
    console.error(`smoke failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

process.exit(main());
