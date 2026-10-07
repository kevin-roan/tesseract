import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INSTALL_SIDECAR, SIDECAR_KEYS } from "../../../cli/constants";
import { createRuntime } from "../../../cli/runtime";
import { refreshInstallSidecar, sidecarLayout, syncSandboxContext } from "./cli-sidecar";

let root: string;
let home: string;
let bundle: string;
const appImage = "/home/u/Apps/Monolith.AppImage";

function writeBundle(manifest: string, compose = "services: {}\n"): void {
  mkdirSync(join(bundle, "infra", "compose"), { recursive: true });
  writeFileSync(join(bundle, "infra", "compose", "compose.yml"), compose);
  writeFileSync(join(bundle, "manifest.json"), manifest);
}

function installCopy(): string {
  const { copyPath } = sidecarLayout(home);
  mkdirSync(join(copyPath, ".."), { recursive: true });
  writeFileSync(copyPath, "binary");
  return copyPath;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cli-sidecar-"));
  home = join(root, "home");
  bundle = join(root, "mount", "resources", "sandbox");
  writeBundle('{"gitCommit":"a"}');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("sidecarLayout", () => {
  it("puts the sidecar next to the CLI copy's bin dir, where the CLI reads it", () => {
    const layout = sidecarLayout("/home/u");
    expect(layout.copyPath).toBe("/home/u/.local/share/monolith/bin/monolith");
    expect(layout.file).toBe(join("/home/u/.local/share/monolith", INSTALL_SIDECAR));
    expect(layout.sandboxDir).toBe("/home/u/.local/share/monolith/sandbox");
  });
});

describe("syncSandboxContext", () => {
  it("copies once and again only when the bundle manifest changes", async () => {
    const target = join(root, "stable");
    expect(await syncSandboxContext(bundle, target)).toBe(true);
    expect(readFileSync(join(target, "infra", "compose", "compose.yml"), "utf8")).toBe("services: {}\n");
    expect(await syncSandboxContext(bundle, target)).toBe(false);

    writeBundle('{"gitCommit":"b"}', "services: { sandbox: {} }\n");
    writeFileSync(join(target, "stale.txt"), "old");
    expect(await syncSandboxContext(bundle, target)).toBe(true);
    expect(readFileSync(join(target, "infra", "compose", "compose.yml"), "utf8")).toBe("services: { sandbox: {} }\n");
    expect(existsSync(join(target, "stale.txt"))).toBe(false);
  });
});

describe("refreshInstallSidecar", () => {
  it("does nothing without an installed CLI copy", async () => {
    expect(await refreshInstallSidecar({ home, appImage, bundledSandboxDir: bundle })).toBeNull();
    expect(existsSync(sidecarLayout(home).file)).toBe(false);
  });

  it("writes {appPath, sandboxDir} pointing at a stable sandbox copy", async () => {
    installCopy();
    const layout = sidecarLayout(home);
    expect(await refreshInstallSidecar({ home, appImage, bundledSandboxDir: bundle })).toEqual({
      appPath: appImage,
      sandboxDir: layout.sandboxDir,
    });
    const written = JSON.parse(readFileSync(layout.file, "utf8")) as Record<string, string>;
    expect(written[SIDECAR_KEYS.appPath]).toBe(appImage);
    expect(written[SIDECAR_KEYS.sandboxDir]).toBe(layout.sandboxDir);

    await refreshInstallSidecar({ home, appImage: "/home/u/Apps/Monolith-2.AppImage", bundledSandboxDir: bundle });
    expect(JSON.parse(readFileSync(layout.file, "utf8"))).toMatchObject({ appPath: "/home/u/Apps/Monolith-2.AppImage" });
  });

  it("lets the CLI copy resolve the sandbox context and the AppImage", async () => {
    const copyPath = installCopy();
    const fakeAppImage = join(root, "Monolith.AppImage");
    writeFileSync(fakeAppImage, "");
    rmSync(bundle, { recursive: true, force: true });
    bundle = join(root, "mount-2", "resources", "sandbox");
    writeBundle('{"gitCommit":"c"}');
    await refreshInstallSidecar({ home, appImage: fakeAppImage, bundledSandboxDir: bundle });
    rmSync(join(root, "mount-2"), { recursive: true, force: true });

    const runtime = createRuntime({
      env: {},
      platform: "linux",
      arch: "x64",
      home,
      execPath: copyPath,
      moduleDir: join(root, "nowhere", "a", "b"),
      cwd: root,
    });
    expect(runtime.sandboxContextDir()).toBe(sidecarLayout(home).sandboxDir);
    expect(runtime.appExecutable()).toBe(fakeAppImage);
  });
});
