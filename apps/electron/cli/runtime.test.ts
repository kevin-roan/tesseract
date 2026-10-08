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
  it("recognises resources/bin/tesseract inside an installed app", () => {
    const exists = (path: string) => path === "/opt/Tesseract/resources/app.asar";
    expect(packagedResourcesDir("/opt/Tesseract/resources/bin/tesseract", exists)).toBe("/opt/Tesseract/resources");
    expect(packagedResourcesDir("/usr/bin/node", exists)).toBeNull();
  });

  it("finds the app executable next to the resources on every platform", () => {
    expect(appExecutableCandidates(input({}), "/opt/Tesseract/resources")[0]).toBe("/opt/Tesseract/tesseract-desktop");
    expect(appExecutableCandidates(input({ platform: "darwin" }), "/Applications/Tesseract.app/Contents/Resources")[0]).toBe(
      "/Applications/Tesseract.app/Contents/MacOS/Tesseract",
    );
    const windows = appExecutableCandidates(input({ platform: "win32", env: { LOCALAPPDATA: "C:/Users/dev/AppData/Local" } }), null);
    expect(windows.at(-1)).toContain(join("Programs", "Tesseract", "Tesseract.exe"));
    expect(appExecutableCandidates(input({ env: { TESSERACT_APP_PATH: "/custom/app" } }), null)[0]).toBe("/custom/app");
  });

  it("finds a server deploy's sandbox next to its bin directory without TESSERACT_SANDBOX_CONTEXT", () => {
    const sandboxDir = "/Users/me/.tesseract/sandbox";
    const exists = (path: string) => path === sandboxDir || path === join(sandboxDir, "infra", "compose");
    const runtime = createRuntime(input({ platform: "darwin", home: "/Users/me", execPath: "/Users/me/.tesseract/bin/tesseract", exists }));
    expect(runtime.resourcesDir).toBe("/Users/me/.tesseract");
    expect(runtime.sandboxContextDir()).toBe(sandboxDir);
  });

  it("searches the override, the bundle, the source tree and the cwd ancestors for the sandbox files", () => {
    const candidates = contextDirCandidates(input({ env: { TESSERACT_SANDBOX_CONTEXT: "/ctx" } }), "/opt/Tesseract/resources");
    expect(candidates.slice(0, 3)).toEqual(["/ctx", "/opt/Tesseract/resources/sandbox", "/src"]);
    expect(candidates).toContain("/work");
    expect(candidates.at(-1)).toBe("/");
  });
});

describe("installed copy sidecar", () => {
  const copy = "/home/dev/.local/share/tesseract/bin/tesseract";
  const sidecarFile = "/home/dev/.local/share/tesseract/app.json";
  const readText = (path: string) =>
    path === sidecarFile ? JSON.stringify({ appPath: "/home/dev/Apps/Tesseract.AppImage", sandboxDir: "/home/dev/.local/share/tesseract/sandbox" }) : null;

  it("reads the AppImage path and the copied sandbox files next to the copied binary", () => {
    expect(installSidecar(copy, readText)).toEqual({
      appPath: "/home/dev/Apps/Tesseract.AppImage",
      sandboxDir: "/home/dev/.local/share/tesseract/sandbox",
    });
    expect(installSidecar("/usr/bin/node", readText)).toBeNull();
    expect(installSidecar(copy, () => "not json")).toBeNull();
  });

  it("uses the sidecar to find the sandbox context and the app", () => {
    const present = new Set(["/home/dev/Apps/Tesseract.AppImage", join("/home/dev/.local/share/tesseract/sandbox", "infra", "compose")]);
    const runtime = createRuntime(input({ execPath: copy, readText, exists: (path) => present.has(path) }));
    expect(runtime.appExecutable()).toBe("/home/dev/Apps/Tesseract.AppImage");
    expect(runtime.sandboxContextDir()).toBe("/home/dev/.local/share/tesseract/sandbox");
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
      JSON.stringify({ sandboxStack: { envFile: "/elsewhere/.env", project: "tesseract", image: "tesseract/sandbox:latest", mode: "local" } }),
    );
    expect((await sandbox.runtime.sandboxContext()).envFile).toBe("/elsewhere/.env");
  });

  it("explains when the sandbox build files are missing", () => {
    const runtime = createRuntime(input({}));
    expect(() => runtime.sandboxContextDir()).toThrow(/TESSERACT_SANDBOX_CONTEXT/);
  });
});
