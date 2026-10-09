import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "./lib/args.ts";
import { APP_DIR, CLI_DIST_DIR, REPO_ROOT } from "./lib/paths.ts";
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

function main(): number {
  const args = parseArgs(process.argv.slice(2), ["target"]);
  const targets = args.flags.has("all")
    ? BUILD_TARGETS
    : (args.values.get("target") ?? hostTargetId()).split(",").map((id) => findTarget(id.trim()));
  const binaries = args.flags.has("no-controller") ? BINARIES.filter((binary) => binary.name === "tesseract") : BINARIES;
  for (const target of targets) pruneStale(target);
  for (const target of targets) for (const binary of binaries) compile(target, binary.name, binary.entry);
  return 0;
}

process.exit(main());
