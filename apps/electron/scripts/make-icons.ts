import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ICON_SHAPES, ICON_SOURCE, icoArgs, LINUX_SIZES, masterArgs, resizeArgs } from "./lib/icons.ts";
import { APP_DIR, REPO_ROOT } from "./lib/paths.ts";

const BUILD_DIR = join(APP_DIR, "build");

function magick(args: string[]): void {
  const result = spawnSync("magick", args, { stdio: "inherit" });
  if (result.error) throw new Error("make-icons needs ImageMagick 7 (magick) on PATH");
  if (result.status !== 0) throw new Error(`magick ${args.join(" ")} failed`);
}

function main(): number {
  const source = join(REPO_ROOT, ICON_SOURCE);
  const master = join(BUILD_DIR, "icon.png");
  magick(masterArgs(source, ICON_SHAPES.standard, master));
  magick(masterArgs(source, ICON_SHAPES.mac, join(BUILD_DIR, "icon-mac.png")));
  mkdirSync(join(BUILD_DIR, "icons"), { recursive: true });
  for (const size of LINUX_SIZES) magick(resizeArgs(master, size, join(BUILD_DIR, "icons", `${size}x${size}.png`)));
  magick(icoArgs(master, join(BUILD_DIR, "icon.ico")));
  console.log(`icons written to ${BUILD_DIR}`);
  return 0;
}

process.exit(main());
