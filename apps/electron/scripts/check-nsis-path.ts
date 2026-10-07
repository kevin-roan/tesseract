import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { SANDBOX_PREFIX } from "./lib/electron.ts";
import { NSIS_TEST_RESULT, nsisPathMismatches, nsisPathScript } from "./lib/nsis-path.ts";
import { APP_DIR } from "./lib/paths.ts";

const NSIS_DIR = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "electron-builder", "nsis", "nsis-3.0.4.1");
const WINE_ENV = { WINEDEBUG: "-all", WINEDLLOVERRIDES: "mscoree=;mshtml=;winemenubuilder.exe=d" };

function run(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  const result = spawnSync(file, args, { cwd, env, stdio: ["ignore", "ignore", "inherit"], timeout: 300_000 });
  if (result.status !== 0) throw new Error(`${file} ${args.join(" ")} failed (exit ${result.status ?? result.signal})`);
}

function main(): number {
  const makensis = join(NSIS_DIR, "linux", "makensis");
  if (!existsSync(makensis)) {
    console.error(`missing ${makensis}; run a Windows dist build once so electron-builder downloads NSIS`);
    return 2;
  }
  const dir = mkdtempSync(join(tmpdir(), `${SANDBOX_PREFIX}nsis-`));
  const env: NodeJS.ProcessEnv = { ...process.env, ...WINE_ENV, NSISDIR: NSIS_DIR, WINEPREFIX: join(dir, "wine") };
  delete env.DISPLAY;
  delete env.WAYLAND_DISPLAY;
  try {
    const result = join(dir, NSIS_TEST_RESULT);
    writeFileSync(join(dir, "test.nsi"), nsisPathScript(join(APP_DIR, "build", "installer.nsh"), result));
    run(makensis, ["-WX", "-V2", "test.nsi"], dir, env);
    run("wineboot", ["-i"], dir, env);
    run("wine", ["path-test.exe"], dir, env);
    const mismatches = nsisPathMismatches(readFileSync(result, "utf8"));
    for (const line of mismatches) console.error(line);
    console.log(mismatches.length === 0 ? "installer.nsh PATH logic ok" : "installer.nsh PATH logic failed");
    return mismatches.length === 0 ? 0 : 1;
  } finally {
    spawnSync("wineserver", ["-k"], { env });
    rmSync(dir, { recursive: true, force: true });
  }
}

process.exit(main());
