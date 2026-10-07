import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { PNG } from "pngjs";
import { parseArgs } from "./lib/args.ts";
import { ensureBuild } from "./lib/build.ts";
import { APP_DIR, REPO_ROOT, resolveInput } from "./lib/paths.ts";

const MAPPING_DIR = join(APP_DIR, "scripts", "parity");
const REFERENCE_DIR = join(REPO_ROOT, "docs", "electron", "reference");
const OUTPUT_DIR = "/tmp/monolith-parity";
const DEFAULT_SCENARIO = "gtk-parity";
const DEFAULT_JOBS = 3;
const SNAPSHOT_ATTEMPTS = 3;
const PARITY_TZ = "UTC";
const SPLIT_PARAM = "split";
const USAGE =
  "usage: bun run --cwd apps/electron parity -- [--area <name>] [--only <substring>] [--jobs 3] [--rebuild]\n" +
  `mappings: ${MAPPING_DIR}/<area>.json = [{ reference, route, scenario?, light?, width, height, collapsedSidebar?, collapsed? }]`;

export interface ParityEntry {
  reference: string;
  route: string;
  scenario?: string;
  light?: boolean;
  width: number;
  height: number;
  collapsedSidebar?: boolean;
  collapsed?: boolean;
}

interface ParityJob {
  area: string;
  name: string;
  entry: ParityEntry;
  actual: string;
  diff: string;
}

interface ParityResult {
  job: ParityJob;
  percent: number | null;
  note: string;
}

function loadAreas(filter: string | undefined): Map<string, ParityEntry[]> {
  const areas = new Map<string, ParityEntry[]>();
  for (const file of readdirSync(MAPPING_DIR).filter((name) => name.endsWith(".json")).sort()) {
    const area = basename(file, ".json");
    if (filter && area !== filter) continue;
    areas.set(area, JSON.parse(readFileSync(join(MAPPING_DIR, file), "utf8")) as ParityEntry[]);
  }
  return areas;
}

export function parityRoute(entry: ParityEntry): string {
  const [path = "/", query = ""] = entry.route.split("?", 2);
  const extra = [`scenario=${entry.scenario ?? DEFAULT_SCENARIO}`];
  if (entry.collapsedSidebar) extra.push(`${SPLIT_PARAM}=sidebar`);
  else if (entry.collapsed) extra.push(`${SPLIT_PARAM}=content`);
  return `${path}?${[query, ...extra].filter(Boolean).join("&")}`;
}

function isBlank(path: string): boolean {
  const { data } = PNG.sync.read(readFileSync(path));
  for (let index = 4; index < data.length; index += 4) {
    if (data[index] !== data[0] || data[index + 1] !== data[1] || data[index + 2] !== data[2]) return false;
  }
  return true;
}

function run(command: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: APP_DIR, env: { ...process.env, TZ: PARITY_TZ } });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

async function measure(job: ParityJob): Promise<ParityResult> {
  const { entry } = job;
  const direct = resolveInput(entry.reference);
  const reference = existsSync(direct) ? direct : join(REFERENCE_DIR, basename(entry.reference));
  if (!existsSync(reference)) return { job, percent: null, note: "reference missing" };
  const snapshotArgs = [
    "scripts/snapshot.ts",
    "--route",
    parityRoute(entry),
    "--out",
    job.actual,
    "--width",
    String(entry.width),
    "--height",
    String(entry.height),
    ...(entry.light ? ["--light"] : []),
  ];
  let snapshot = await run(process.execPath, snapshotArgs);
  for (let attempt = 1; attempt < SNAPSHOT_ATTEMPTS && snapshot.code === 0 && isBlank(job.actual); attempt += 1) {
    snapshot = await run(process.execPath, snapshotArgs);
  }
  if (snapshot.code !== 0) return { job, percent: null, note: `snapshot failed: ${snapshot.output.trim().split("\n").pop() ?? ""}` };
  const diff = await run(process.execPath, ["scripts/diff.ts", job.actual, reference, "--out", job.diff]);
  const match = /mismatch: ([\d.]+)%/.exec(diff.output);
  if (!match) return { job, percent: null, note: `diff failed: ${diff.output.trim()}` };
  const sizes = /\(sizes differ[^)]*\)/.exec(diff.output);
  return { job, percent: Number(match[1]), note: sizes?.[0] ?? "" };
}

async function pool<T, R>(items: readonly T[], jobs: number, work: (item: T) => Promise<R>, done: (result: R) => void): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const result = await work(items[index] as T);
      results[index] = result;
      done(result);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, worker));
  return results;
}

function printTable(results: readonly ParityResult[]): void {
  const rows = results.map(({ job, percent, note }) => [job.area, job.name, percent === null ? "error" : `${percent.toFixed(2)}%`, note]);
  const header = ["area", "view", "mismatch", "note"];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => (row[column] ?? "").length)));
  const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join("  ").trimEnd();
  console.log(line(header));
  console.log(line(widths.map((width) => "-".repeat(width))));
  for (const row of rows) console.log(line(row));
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), ["area", "only", "jobs"]);
  if (args.flags.has("help")) {
    console.log(USAGE);
    return 0;
  }
  const areas = loadAreas(args.values.get("area"));
  if (areas.size === 0) {
    console.error(`no mapping for area ${args.values.get("area") ?? "(any)"}\n${USAGE}`);
    return 2;
  }
  const only = args.values.get("only");
  const jobs: ParityJob[] = [];
  for (const [area, entries] of areas) {
    const dir = join(OUTPUT_DIR, area);
    mkdirSync(dir, { recursive: true });
    for (const entry of entries) {
      const name = basename(entry.reference, ".png");
      if (only && !name.includes(only)) continue;
      jobs.push({ area, name, entry, actual: join(dir, `${name}-actual.png`), diff: join(dir, `${name}-diff.png`) });
    }
  }
  ensureBuild(args.flags.has("rebuild"));
  const results = await pool(jobs, Number(args.values.get("jobs") ?? DEFAULT_JOBS), measure, ({ job, percent, note }) =>
    console.error(`${job.area}/${job.name}: ${percent === null ? note : `${percent.toFixed(2)}%`}`),
  );
  console.log("");
  printTable(results);
  console.log(`\nactual/diff PNGs: ${OUTPUT_DIR}/<area>/<view>-{actual,diff}.png`);
  return results.some((result) => result.percent === null) ? 1 : 0;
}

process.exit(await main());
