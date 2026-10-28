import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "./lib/args.ts";
import { APP_DIR, CLI_DIST_DIR, REPO_ROOT } from "./lib/paths.ts";
import { SIMCAP_BINARY, SIMCAP_SOURCE_DIR, simcapSwiftcArgs } from "./lib/simcap.ts";
import { BUILD_TARGETS, findTarget, hostTargetId, type BuildTarget } from "./lib/targets.ts";

const CLI_ENTRY = join(APP_DIR, "cli", "index.ts");
const CONTROLLER_ENTRY = join(REPO_ROOT, "apps", "controller", "src", "index.ts");
const BINARIES = [
  { name: "tesseract", entry: CLI_ENTRY },
  { name: "tesseract-controller", entry: CONTROLLER_ENTRY },
] as const;

const outDirOf = (target: BuildTarget) => join(CLI_DIST_DIR, `${target.builderOs}-${target.arch}`);

/** electron-builder ships the whole directory, so stale binaries (e.g. theone-controller) break the universal merge. */
function pruneStale(target: BuildTarget): void {
  const outDir = outDirOf(target);
  if (!existsSync(outDir)) return;
  const keep = new Set<string>(BINARIES.map((binary) => `${binary.name}${target.exe}`));
  if (target.builderOs === "mac") keep.add(SIMCAP_BINARY);
  for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(join(outDir, file), { recursive: true, force: true });
}

function compile(target: BuildTarget, name: string, entry: string): void {
  const outDir = outDirOf(target);
  mkdirSync(outDir, { recursive: true });
  const outfile = join(outDir, `${name}${target.exe}`);
  const result = spawnSync("bun", ["build", entry, "--compile", "--minify", `--target=${target.bunTarget}`, "--outfile", outfile], {
    cwd: APP_DIR,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`bun build failed for ${name} (${target.id})`);
  console.log(outfile);
}

/** swiftc only runs on a Mac; elsewhere the controller falls back to idb + ffmpeg JPEGs for the iOS screen. */
function compileSimcap(target: BuildTarget): void {
  const outfile = join(outDirOf(target), SIMCAP_BINARY);
  const sourceDir = join(REPO_ROOT, SIMCAP_SOURCE_DIR);
  if (process.platform !== "darwin") {
    console.warn(`skipping ${SIMCAP_BINARY} (${target.id}): swiftc needs a macOS host`);
    return;
  }
  const sources = existsSync(sourceDir)
    ? readdirSync(sourceDir)
        .filter((file) => file.endsWith(".swift"))
        .sort()
        .map((file) => join(sourceDir, file))
    : [];
  if (sources.length === 0) {
    console.warn(`skipping ${SIMCAP_BINARY} (${target.id}): no Swift sources in ${SIMCAP_SOURCE_DIR}`);
    return;
  }
  mkdirSync(outDirOf(target), { recursive: true });
  // A failed build must not leave the previous binary behind as if it were current.
  rmSync(outfile, { force: true });
  const result = spawnSync("xcrun", simcapSwiftcArgs(target, sources, outfile), { cwd: REPO_ROOT, stdio: "inherit" });
  if (result.status !== 0) {
    console.warn(`skipping ${SIMCAP_BINARY} (${target.id}): swiftc failed (install Xcode or the Command Line Tools)`);
    return;
  }
  console.log(outfile);
}

function main(): number {
  const args = parseArgs(process.argv.slice(2), ["target"]);
  const targets = args.flags.has("all")
    ? BUILD_TARGETS
    : (args.values.get("target") ?? hostTargetId()).split(",").map((id) => findTarget(id.trim()));
  const binaries = args.flags.has("no-controller") ? BINARIES.filter((binary) => binary.name === "tesseract") : BINARIES;
  for (const target of targets) pruneStale(target);
  for (const target of targets) for (const binary of binaries) compile(target, binary.name, binary.entry);
  if (!args.flags.has("no-simcap")) for (const target of targets) if (target.builderOs === "mac") compileSimcap(target);
  return 0;
}

process.exit(main());
