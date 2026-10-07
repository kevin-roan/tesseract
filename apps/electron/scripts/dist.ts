import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parseArgs } from "./lib/args.ts";
import { builderArgs, CLI_TARGETS, DIST_VALUE_FLAGS, distPlan, requiredCliFiles } from "./lib/dist-plan.ts";
import { APP_DIR, SANDBOX_BUNDLE_DIR } from "./lib/paths.ts";

const require = createRequire(import.meta.url);
const USAGE =
  "usage: node scripts/dist.ts [--platform linux|mac|win] [--dir] [--publish never|always|onTag] [--update-url <url>] [--channel <name>] [--skip-build] [--skip-cli] [--skip-sandbox] [--smoke]";

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: APP_DIR, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status ?? result.signal})`);
}

function main(): number {
  const args = parseArgs(process.argv.slice(2), DIST_VALUE_FLAGS);
  if (args.flags.has("help")) {
    console.log(USAGE);
    return 0;
  }
  const plan = distPlan(args, process.env);
  if (plan.build) run("bun", ["run", "build"]);
  if (plan.cli) run(process.execPath, ["scripts/cli-build.ts", "--target", CLI_TARGETS[plan.platform].join(",")]);
  if (plan.sandbox) run(process.execPath, ["scripts/bundle-sandbox.ts"]);
  const missing = requiredCliFiles(plan.platform).filter((file) => !existsSync(join(APP_DIR, file)));
  if (missing.length > 0) throw new Error(`missing CLI binaries (run cli:build): ${missing.join(", ")}`);
  if (!existsSync(join(SANDBOX_BUNDLE_DIR, "manifest.json"))) throw new Error("missing build/sandbox-context (run bundle:sandbox)");
  run(process.execPath, [require.resolve("electron-builder/cli.js"), ...builderArgs(plan)]);
  if (plan.smoke) run(process.execPath, ["scripts/smoke.ts"]);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`dist: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
