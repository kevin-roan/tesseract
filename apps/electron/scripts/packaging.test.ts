import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { APP_ID, APP_NAME, DEEP_LINK_SCHEME } from "../src/shared/runtime.ts";
import { ICO_SIZES, LINUX_SIZES } from "./lib/icons.ts";
import { APP_DIR } from "./lib/paths.ts";
import { pngSize } from "./lib/smoke.ts";

interface Target {
  target: string;
  arch: string[];
}

interface BuilderConfig {
  appId: string;
  productName: string;
  afterSign: string;
  electronFuses: Record<string, boolean>;
  extraResources: { from: string; to: string }[];
  protocols: { schemes: string[] }[];
  publish: { provider: string; url: string };
  mac: { icon: string; target: Target[]; hardenedRuntime: boolean; notarize: boolean; entitlements: string; entitlementsInherit: string };
  win: { icon: string; target: Target[] };
  nsis: { oneClick: boolean; perMachine: boolean; include: string; installerIcon: string };
  linux: { icon: string; executableName: string; target: Target[] };
  deb: { afterInstall: string; afterRemove: string };
}

const config = parse(readFileSync(join(APP_DIR, "electron-builder.yml"), "utf8")) as BuilderConfig;
const file = (path: string) => join(APP_DIR, path);
const read = (path: string) => readFileSync(file(path), "utf8");

describe("electron-builder.yml", () => {
  it("identifies the app like the GTK app", () => {
    expect(config.appId).toBe(APP_ID);
    expect(config.productName).toBe(APP_NAME);
    expect(config.protocols[0]?.schemes).toEqual([DEEP_LINK_SCHEME]);
  });

  it("ships the CLI binaries, sandbox build context, icons and font licenses", () => {
    expect(config.extraResources.map(({ from, to }) => `${from} -> ${to}`)).toEqual([
      "dist-cli/${os}-${arch} -> bin",
      "build/sandbox-context -> sandbox",
      "build/icons -> icons",
      "src/renderer/theme/fonts -> licenses",
    ]);
  });

  it("targets a universal dmg plus the zip electron-updater needs on macOS", () => {
    expect(config.mac.target).toEqual([
      { target: "dmg", arch: ["universal"] },
      { target: "zip", arch: ["universal"] },
    ]);
    expect(config.mac.hardenedRuntime).toBe(true);
    expect(config.mac.notarize).toBe(false);
    expect(existsSync(file(config.afterSign))).toBe(true);
  });

  it("installs per user on Windows with the PATH include", () => {
    expect(config.win.target).toEqual([{ target: "nsis", arch: ["x64"] }]);
    expect(config.nsis).toMatchObject({ oneClick: true, perMachine: false, include: "build/installer.nsh" });
  });

  it("builds an AppImage and a deb on Linux", () => {
    expect(config.linux.target.map((target) => target.target)).toEqual(["AppImage", "deb"]);
    expect(config.linux.executableName).toBe("monolith-desktop");
  });

  it("publishes to a generic update feed", () => {
    expect(config.publish.provider).toBe("generic");
    expect(new URL(config.publish.url).protocol).toBe("https:");
  });

  it("locks down the Electron fuses", () => {
    expect(config.electronFuses).toMatchObject({ runAsNode: false, enableNodeOptionsEnvironmentVariable: false, onlyLoadAppFromAsar: true });
  });

  it("references files that exist", () => {
    const paths = [
      config.mac.icon,
      config.mac.entitlements,
      config.mac.entitlementsInherit,
      config.win.icon,
      config.nsis.include,
      config.nsis.installerIcon,
      config.linux.icon,
      config.deb.afterInstall,
      config.deb.afterRemove,
    ];
    for (const path of paths) expect(existsSync(file(path)), path).toBe(true);
  });
});

describe("build resources", () => {
  it("has a 1024px master icon for every platform", () => {
    expect(pngSize(readFileSync(file("build/icon.png")))).toEqual({ width: 1024, height: 1024 });
    expect(pngSize(readFileSync(file(config.mac.icon)))).toEqual({ width: 1024, height: 1024 });
  });

  it("has every hicolor size for Linux", () => {
    for (const size of LINUX_SIZES) expect(pngSize(readFileSync(file(`build/icons/${size}x${size}.png`)))).toEqual({ width: size, height: size });
  });

  it("has a multi-size Windows icon", () => {
    const ico = readFileSync(file(config.win.icon));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(ICO_SIZES.length);
  });

  it("grants the hardened-runtime exceptions Electron and the Bun CLI need", () => {
    const plist = read(config.mac.entitlements);
    for (const key of ["allow-jit", "allow-unsigned-executable-memory", "disable-library-validation", "device.audio-input"]) {
      expect(plist).toContain(`com.apple.security.${key.startsWith("device") ? key : `cs.${key}`}`);
    }
    expect(plist).not.toContain("com.apple.security.app-sandbox");
  });

  it("adds and removes the CLI directory from the user PATH in NSIS", () => {
    const nsh = read(config.nsis.include);
    expect(nsh).toMatch(/!macro customInstall\s+Push "add"\s+Call MonolithUpdateUserPath/);
    expect(nsh).toMatch(/!macro customUnInstall\s+\$\{IfNot\} \$\{isUpdated\}\s+Push "remove"\s+Call un\.MonolithUpdateUserPath/);
    expect(nsh).toContain('!define MONOLITH_CLI_DIR "$INSTDIR\\resources\\bin"');
    expect(nsh).toContain("WriteRegExpandStr HKCU");
    expect(nsh).toMatch(/!ifdef BUILD_UNINSTALLER\s+!insertmacro MONOLITH_PATH_FUNCTIONS "un\."\s+!else\s+!insertmacro MONOLITH_PATH_FUNCTIONS ""/);
    expect(nsh).not.toContain("StrFunc");
  });

  it("links /usr/bin/tesseract from the deb scripts without taking over a foreign one", () => {
    const install = read(config.deb.afterInstall);
    const remove = read(config.deb.afterRemove);
    expect(install).toContain("CLI_LINK=/usr/bin/tesseract");
    expect(install).toContain('CLI_TARGET="$APP_DIR/resources/bin/tesseract"');
    expect(install).toContain("is not ours; leaving it alone");
    expect(install).toContain("apparmor-profile");
    expect(remove).toContain('rm -f "$CLI_LINK"');
    for (const script of [config.deb.afterInstall, config.deb.afterRemove]) {
      expect(spawnSync("sh", ["-n", file(script)]).status, script).toBe(0);
      expect(statSync(file(script)).mode & 0o111, script).not.toBe(0);
    }
  });
});
