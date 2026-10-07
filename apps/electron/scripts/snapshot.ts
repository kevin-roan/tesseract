import { spawnSync } from "node:child_process";
import { encodeSnapshotArg, type SnapshotRequest } from "../src/shared/runtime.ts";
import { parseArgs } from "./lib/args.ts";
import { ensureBuild } from "./lib/build.ts";
import { electronBinary, headlessSwitches, isolatedProfile } from "./lib/electron.ts";
import { APP_DIR, resolveOutput } from "./lib/paths.ts";

const DEFAULTS = { width: 1024, height: 768, timeoutMs: 20_000, route: "/overview" } as const;
const USAGE =
  "usage: bun run --cwd apps/electron snapshot -- --route <route> --out <file.png> [--light] [--width 1024 --height 768] [--rebuild] [--headed]";

function main(): number {
  const args = parseArgs(process.argv.slice(2), ["route", "out", "width", "height", "timeout"]);
  const out = args.values.get("out");
  if (!out || args.flags.has("help")) {
    console.error(USAGE);
    return out ? 0 : 2;
  }
  ensureBuild(args.flags.has("rebuild"));
  const width = Number(args.values.get("width") ?? DEFAULTS.width);
  const height = Number(args.values.get("height") ?? DEFAULTS.height);
  const route = args.values.get("route") ?? DEFAULTS.route;
  const request: SnapshotRequest = {
    route: route.startsWith("/") ? route : `/${route}`,
    out: resolveOutput(out),
    width,
    height,
    appearance: args.flags.has("light") ? "light" : "dark",
    timeoutMs: Number(args.values.get("timeout") ?? DEFAULTS.timeoutMs),
  };
  const profile = isolatedProfile();
  try {
    const switches = args.flags.has("headed") ? [] : headlessSwitches(width, height);
    const result = spawnSync(
      electronBinary(),
      [...switches, "--force-device-scale-factor=1", APP_DIR, encodeSnapshotArg(request)],
      { env: profile.env, stdio: "inherit", timeout: request.timeoutMs + 60_000 },
    );
    if (result.status !== 0) {
      console.error(`snapshot failed (exit ${result.status ?? result.signal})`);
      return 1;
    }
    console.log(request.out);
    return 0;
  } finally {
    profile.dispose();
  }
}

process.exit(main());
