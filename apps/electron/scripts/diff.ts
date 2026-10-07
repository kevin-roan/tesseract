import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { parseArgs } from "./lib/args.ts";
import { resolveInput, resolveOutput } from "./lib/paths.ts";

const DEFAULT_THRESHOLD = 0.1;
const USAGE = "usage: bun run --cwd apps/electron diff -- <a.png> <b.png> [--out diff.png] [--threshold 0.1] [--max <percent>]";

function load(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

function crop(image: PNG, width: number, height: number): PNG {
  const result = new PNG({ width, height });
  PNG.bitblt(image, result, 0, 0, width, height, 0, 0);
  return result;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2), ["out", "threshold", "max"]);
  const [first, second] = args.positional.map(resolveInput);
  if (!first || !second) {
    console.error(USAGE);
    return 2;
  }
  const a = load(first);
  const b = load(second);
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const diff = new PNG({ width, height });
  const changed = pixelmatch(crop(a, width, height).data, crop(b, width, height).data, diff.data, width, height, {
    threshold: Number(args.values.get("threshold") ?? DEFAULT_THRESHOLD),
  });
  const total = Math.max(a.width, b.width) * Math.max(a.height, b.height);
  const mismatched = changed + (total - width * height);
  const percent = (mismatched / total) * 100;
  const out = args.values.get("out");
  if (out) {
    const target = resolveOutput(out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, PNG.sync.write(diff));
  }
  const sizeNote = a.width === b.width && a.height === b.height ? "" : ` (sizes differ: ${a.width}x${a.height} vs ${b.width}x${b.height})`;
  console.log(`mismatch: ${percent.toFixed(2)}% (${mismatched} of ${total} pixels)${sizeNote}`);
  const max = args.values.get("max");
  return max !== undefined && percent > Number(max) ? 1 : 0;
}

process.exit(main());
