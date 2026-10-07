import { join, resolve } from "node:path";
import { app } from "electron";
import { sandboxDir } from "../../core/paths";
import type { SandboxContext } from "../../core/sandbox";
import { mainContext } from "../context";

export const ENV_FILE_NAME = ".env";

export function repoRoot(): string | null {
  return app.isPackaged ? null : resolve(app.getAppPath(), "..", "..");
}

export function bundledResource(...segments: string[]): string {
  return app.isPackaged ? join(process.resourcesPath, ...segments) : join(app.getAppPath(), "build", ...segments);
}

export function sandboxContextDir(): string {
  return repoRoot() ?? join(process.resourcesPath, "sandbox");
}

export function sandboxContext(): SandboxContext {
  return {
    contextDir: sandboxContextDir(),
    envFile: join(sandboxDir(mainContext().paths), ENV_FILE_NAME),
    env: process.env,
  };
}
