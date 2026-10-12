import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "./lib/args.ts";
import { APP_DIR, REPO_ROOT } from "./lib/paths.ts";
import { nextVersion, readVersion, setLockVersion, setPackageVersion } from "./lib/release.ts";

const BRANCH = "main";
const RELEASE_BRANCH = "production";
const PACKAGE_JSON = join(APP_DIR, "package.json");
const BUN_LOCK = join(REPO_ROOT, "bun.lock");

function git(args: string[]): string {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed (exit ${result.status ?? result.signal})`);
  return result.stdout.trim();
}

function main(): number {
  const args = parseArgs(process.argv.slice(2), []);
  const dryRun = args.flags.has("dry-run");
  const bump = args.positional[0] ?? "patch";

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== BRANCH) throw new Error(`release from ${BRANCH}, not ${branch}`);
  if (git(["status", "--porcelain"]) !== "") throw new Error("working tree is not clean; commit or stash first");
  git(["fetch", "--quiet", "--tags", "origin", BRANCH, RELEASE_BRANCH]);
  if (git(["rev-list", "--count", `HEAD..origin/${BRANCH}`]) !== "0") throw new Error(`${BRANCH} is behind origin/${BRANCH}; pull first`);
  if (git(["rev-list", "--count", `HEAD..origin/${RELEASE_BRANCH}`]) !== "0") {
    throw new Error(`origin/${RELEASE_BRANCH} has commits that are not on ${BRANCH}; merge it into ${BRANCH} first`);
  }

  const packageJson = readFileSync(PACKAGE_JSON, "utf8");
  const current = readVersion(packageJson);
  const version = nextVersion(current, bump);
  const tag = `v${version}`;
  if (git(["tag", "--list", tag]) !== "") throw new Error(`${tag} already exists`);

  console.log(`${current} -> ${version}: commit on ${BRANCH}, push ${BRANCH} and ${RELEASE_BRANCH}; CI publishes ${tag}`);
  if (dryRun) return 0;

  writeFileSync(PACKAGE_JSON, setPackageVersion(packageJson, version));
  writeFileSync(BUN_LOCK, setLockVersion(readFileSync(BUN_LOCK, "utf8"), version));
  git(["commit", "--quiet", "-m", `release; ${tag}`, "--", PACKAGE_JSON, BUN_LOCK]);
  git(["push", "--quiet", "--atomic", "origin", `${BRANCH}:${BRANCH}`, `${BRANCH}:${RELEASE_BRANCH}`]);
  console.log(`pushed ${tag}; follow the Desktop run in the Actions tab`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
