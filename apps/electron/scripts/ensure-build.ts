import { ensureBuild } from "./lib/build.ts";

ensureBuild(process.argv.includes("--force"));
