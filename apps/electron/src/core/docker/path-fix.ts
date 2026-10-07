import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, win32 } from "node:path";

export function pathFixDirs(platform: NodeJS.Platform, home: string, env: Record<string, string | undefined>): string[] {
  if (platform === "darwin") {
    return [
      "/usr/local/bin",
      "/opt/homebrew/bin",
      join(home, ".docker", "bin"),
      "/Applications/Docker.app/Contents/Resources/bin",
      join(home, ".orbstack", "bin"),
    ];
  }
  if (platform === "win32") {
    const programFiles = env.ProgramFiles ?? "C:\\Program Files";
    const localAppData = env.LOCALAPPDATA ?? win32.join(home, "AppData", "Local");
    return [
      win32.join(programFiles, "Docker", "Docker", "resources", "bin"),
      win32.join(localAppData, "Programs", "DockerDesktop", "resources", "bin"),
    ];
  }
  return ["/usr/bin", "/usr/local/bin", join(home, "bin")];
}

export function applyPathFix(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  home: string,
  exists: (path: string) => boolean = existsSync,
): NodeJS.ProcessEnv {
  const key = platform === "win32" ? (Object.keys(env).find((name) => name.toLowerCase() === "path") ?? "Path") : "PATH";
  const separator = platform === "win32" ? ";" : delimiter;
  const current = (env[key] ?? "").split(separator).filter(Boolean);
  const extra = pathFixDirs(platform, home, env).filter((dir) => !current.includes(dir) && exists(dir));
  return extra.length ? { ...env, [key]: [...extra, ...current].join(separator) } : env;
}

export function effectiveEnv(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): NodeJS.ProcessEnv {
  return applyPathFix(env, platform, home);
}

export function refreshProcessPath(platform: NodeJS.Platform = process.platform, home: string = homedir()): NodeJS.ProcessEnv {
  const fixed = applyPathFix(process.env, platform, home);
  for (const [key, value] of Object.entries(fixed)) {
    if (process.env[key] !== value && value !== undefined) process.env[key] = value;
  }
  return process.env;
}
