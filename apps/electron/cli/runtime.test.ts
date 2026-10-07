import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appExecutableCandidates, contextDirCandidates, createRuntime, installSidecar, packagedResourcesDir, type RuntimeInput } from "./runtime";
import { tempSandbox, type Sandbox } from "./testing";

function input(overrides: Partial<RuntimeInput>): RuntimeInput {
  return {
    env: {},
    platform: "linux",
    arch: "x64",
    home: "/home/dev",
    execPath: "/usr/bin/node",
    moduleDir: "/src/apps/electron/cli",
    cwd: "/work/project",
    exists: () => false,
    ...overrides,
  };
}

describe("packaged layout", () => {
  it("recognises resources/bin/monolith inside an installed app", () => {
    const exists = (path: string) => path === "/opt/Monolith/resources/app.asar";
    expect(packagedResourcesDir("/opt/Monolith/resources/bin/monolith", exists)).toBe("/opt/Monolith/resources");
    expect(packagedResourcesDir("/usr/bin/node", exists)).toBeNull();
  });

  it("finds the app executable next to the resources on every platform", () => {
    expect(appExecutableCandidates(input({}), "/opt/Monolith/resources")[0]).toBe("/opt/Monolith/monolith-desktop");
    expect(appExecutableCandidates(input({ platform: "darwin" }), "/Applications/Monolith.app/Contents/Resources")[0]).toBe(
      "/Applications/Monolith.app/Contents/MacOS/Monolith",
    );
    const windows = appExecutableCandidates(input({ platform: "win32", env: { LOCALAPPDATA: "C:/Users/dev/AppData/Local" } }), null);
    expect(windows.at(-1)).toContain(join("Programs", "Monolith", "Monolith.exe"));
    expect(appExecutableCandidates(input({ env: { MONOLITH_APP_PATH: "/custom/app" } }), null)[0]).toBe("/custom/app");
  });

  it("searches the override, the bundle, the source tree and the cwd ancestors for the sandbox files", () => {
    const candidates = contextDirCandidates(input({ env: { MONOLITH_SANDBOX_CONTEXT: "/ctx" } }), "/opt/Monolith/resources");
    expect(candidates.slice(0, 3)).toEqual(["/ctx", "/opt/Monolith/resources/sandbox", "/src"]);
    expect(candidates).toContain("/work");
    expect(candidates.at(-1)).toBe("/");
  });
});

describe("installed copy sidecar", () => {
  const copy = "/home/dev/.local/share/monolith/bin/monolith";
  const sidecarFile = "/home/dev/.local/share/monolith/app.json";
  const readText = (path: string) =>
    path === sidecarFile ? JSON.stringify({ appPath: "/home/dev/Apps/Monolith.AppImage", sandboxDir: "/home/dev/.local/share/monolith/sandbox" }) : null;

  it("reads the AppImage path and the copied sandbox files next to the copied binary", () => {
    expect(installSidecar(copy, readText)).toEqual({
      appPath: "/home/dev/Apps/Monolith.AppImage",
      sandboxDir: "/home/dev/.local/share/monolith/sandbox",
    });
    expect(installSidecar("/usr/bin/node", readText)).toBeNull();
    expect(installSidecar(copy, () => "not json")).toBeNull();
  });

  it("uses the sidecar to find the sandbox context and the app", () => {
    const present = new Set(["/home/dev/Apps/Monolith.AppImage", join("/home/dev/.local/share/monolith/sandbox", "infra", "compose")]);
    const runtime = createRuntime(input({ execPath: copy, readText, exists: (path) => present.has(path) }));
    expect(runtime.appExecutable()).toBe("/home/dev/Apps/Monolith.AppImage");
    expect(runtime.sandboxContextDir()).toBe("/home/dev/.local/share/monolith/sandbox");
  });
});

describe("createRuntime", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = tempSandbox();
  });

  afterEach(() => sandbox.cleanup());

  it("resolves the shared config, user data and android cache paths", () => {
    expect(sandbox.runtime.configFile).toBe(sandbox.configFile);
    expect(sandbox.runtime.userDataDir).toBe(join(sandbox.root, "user-data"));
    expect(sandbox.runtime.androidCacheDir).toBe(join(sandbox.root, "user-data", "android", "cache"));
  });

  it("uses the env file recorded by the app when there is one", async () => {
    const fallback = await sandbox.runtime.sandboxContext();
    expect(fallback.contextDir).toBe(sandbox.contextDir);
    expect(fallback.envFile).toBe(join(sandbox.root, "user-data", "sandbox", ".env"));
    mkdirSync(join(sandbox.root, "config"), { recursive: true });
    writeFileSync(
      sandbox.configFile,
      JSON.stringify({ sandboxStack: { envFile: "/elsewhere/.env", project: "theone", image: "theone/sandbox:latest", mode: "local" } }),
    );
    expect((await sandbox.runtime.sandboxContext()).envFile).toBe("/elsewhere/.env");
  });

  it("explains when the sandbox build files are missing", () => {
    const runtime = createRuntime(input({}));
    expect(() => runtime.sandboxContextDir()).toThrow(/MONOLITH_SANDBOX_CONTEXT/);
  });
});
