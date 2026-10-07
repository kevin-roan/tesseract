import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);

export const SANDBOX_PREFIX = "monolith-test-";

export function electronBinary(): string {
  return require("electron") as string;
}

export function headlessSwitches(width: number, height: number, padding = 200): string[] {
  if (process.platform !== "linux") return [];
  return ["--ozone-platform=headless", `--ozone-override-screen-size=${width + padding},${height + padding}`];
}

export interface IsolatedProfile {
  dir: string;
  env: NodeJS.ProcessEnv;
  dispose(): void;
}

export function isolatedProfile(extraEnv: NodeJS.ProcessEnv = {}): IsolatedProfile {
  const dir = mkdtempSync(join(tmpdir(), SANDBOX_PREFIX));
  const configFile = join(dir, "config", "config.json");
  writeFileSync(join(dir, "seed.json"), "{}\n");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MONOLITH_FIXTURES: "1",
    MONOLITH_SNAPSHOT: "1",
    MONOLITH_USER_DATA: join(dir, "user-data"),
    MONOLITH_DESKTOP_CONFIG: configFile,
    MONOLITH_STATE_DIR: join(dir, "state"),
    XDG_CACHE_HOME: join(dir, "cache"),
    ELECTRON_ENABLE_LOGGING: "0",
    ...extraEnv,
  };
  delete env.ELECTRON_RENDERER_URL;
  delete env.ELECTRON_RUN_AS_NODE;
  return { dir, env, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}
