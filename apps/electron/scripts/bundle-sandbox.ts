import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { REPO_ROOT, SANDBOX_BUNDLE_DIR } from "./lib/paths.ts";
import { hasCrlf, needsLf } from "./lib/sandbox-bundle.ts";

const INCLUDED = [
  ".dockerignore",
  "SPEC.md",
  "package.json",
  "bun.lock",
  "bunfig.toml",
  "tsconfig.base.json",
  "packages",
  "apps/controller",
  "apps/mobile/package.json",
  "apps/electron/package.json",
  "infra/docker/sandbox",
  "infra/compose/.env.example",
  "infra/compose/tailscale/serve.json",
] as const;
const COMPOSE_FILE = /^infra\/compose\/compose[^/]*\.yml$/;
const EXCLUDED = [/(^|\/)node_modules\//, /(^|\/)dist\//, /(^|\/)coverage\//, /\.tsbuildinfo$/];
const DOCKERFILE = "infra/docker/sandbox/Dockerfile";
const IMAGE_VERSION = /^ARG THEONE_IMAGE_VERSION=(\S+)/m;
const STEP_INSTRUCTION = /^(FROM|RUN|COPY|ADD|ENV|ARG|WORKDIR|USER|LABEL|SHELL|HEALTHCHECK|EXPOSE|VOLUME|ENTRYPOINT|CMD|STOPSIGNAL|ONBUILD)\b/i;
const HEAVY_STEP = /apt-get install|sdkmanager|flutter precache|cmake|wine|bun install|npm install/;
const HEAVY_WEIGHT = 10;

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

function trackedFiles(): string[] {
  const files = git(["ls-files", "-z", "--", ...INCLUDED, "infra/compose"]).split("\0").filter(Boolean);
  return files
    .filter((file) => !file.startsWith("infra/compose/") || COMPOSE_FILE.test(file) || INCLUDED.includes(file as never))
    .filter((file) => !EXCLUDED.some((pattern) => pattern.test(file)))
    .sort();
}

function buildWeights(dockerfile: string): Record<string, number[]> {
  const stages: Record<string, number[]> = {};
  let current: number[] | null = null;
  const logical = dockerfile.replace(/\\\r?\n/g, " ").split(/\r?\n/);
  for (const line of logical) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !STEP_INSTRUCTION.test(trimmed)) continue;
    const stage = /^FROM\s+\S+\s+AS\s+(\S+)/i.exec(trimmed)?.[1];
    if (stage) {
      current = [1];
      stages[stage] = current;
      continue;
    }
    if (/^ARG\b/i.test(trimmed) && !current) continue;
    current?.push(/^RUN\b/i.test(trimmed) && HEAVY_STEP.test(trimmed) ? HEAVY_WEIGHT : 1);
  }
  return stages;
}

function main(): number {
  rmSync(SANDBOX_BUNDLE_DIR, { recursive: true, force: true });
  const files: Record<string, string> = {};
  const crlf: string[] = [];
  for (const file of trackedFiles()) {
    const source = join(REPO_ROOT, file);
    const target = join(SANDBOX_BUNDLE_DIR, file);
    const content = readFileSync(source);
    if (needsLf(file) && hasCrlf(content)) crlf.push(file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    chmodSync(target, statSync(source).mode & 0o777);
    files[file] = createHash("sha256").update(content).digest("hex");
  }
  if (crlf.length > 0) throw new Error(`CRLF line endings would break the Linux image: ${crlf.join(", ")}`);
  const dockerfile = readFileSync(join(REPO_ROOT, DOCKERFILE), "utf8");
  const manifest = {
    gitCommit: git(["rev-parse", "HEAD"]).trim(),
    dirty: git(["status", "--porcelain", "--", ...INCLUDED]).trim().length > 0,
    imageVersion: IMAGE_VERSION.exec(dockerfile)?.[1] ?? null,
    files,
  };
  writeFileSync(join(SANDBOX_BUNDLE_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(SANDBOX_BUNDLE_DIR, "build-weights.json"), `${JSON.stringify(buildWeights(dockerfile), null, 2)}\n`);
  console.log(`${SANDBOX_BUNDLE_DIR} (${Object.keys(files).length} files)`);
  return 0;
}

process.exit(main());
