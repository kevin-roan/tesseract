import { describe, expect, it } from "vitest";
import { CLI_INSTALL_LABELS } from "../labels";
import { appleScriptString, macInstallScript, pathContains, planCliInstall, type CliEnvironment, type CliProbe } from "./cli-plan";

const linux: CliEnvironment = {
  platform: "linux",
  packaged: true,
  resourcesPath: "/opt/Tesseract/resources",
  home: "/home/u",
  pathEnv: "/usr/bin:/home/u/.local/bin",
  appImage: false,
  inApplicationsFolder: true,
};
const mac: CliEnvironment = { ...linux, platform: "darwin", resourcesPath: "/Applications/Tesseract.app/Contents/Resources", home: "/Users/u" };

function probe(links: Record<string, string> = {}, sizes: Record<string, number> = {}): CliProbe {
  return {
    realpath: (path) => links[path] ?? (path.includes("/resources/bin/") || path.includes("/Resources/bin/") ? path : null),
    size: (path) => sizes[path] ?? null,
  };
}

describe("planCliInstall", () => {
  it("refuses in development builds", () => {
    expect(planCliInstall({ ...linux, packaged: false }, probe()).status).toEqual({
      state: "unsupported",
      binaryPath: null,
      linkPath: null,
      message: CLI_INSTALL_LABELS.dev,
    });
  });

  it("reports the deb's /usr/bin link as installed", () => {
    const plan = planCliInstall(linux, probe({ "/usr/bin/tesseract": "/opt/Tesseract/resources/bin/tesseract" }));
    expect(plan.status).toMatchObject({ state: "installed", linkPath: "/usr/bin/tesseract" });
  });

  it("links ~/.local/bin/tesseract when nothing is installed", () => {
    const plan = planCliInstall(linux, probe());
    expect(plan).toMatchObject({ method: "symlink", copyPath: null, status: { state: "missing", linkPath: "/home/u/.local/bin/tesseract", message: null } });
  });

  it("warns when ~/.local/bin is not on PATH", () => {
    const plan = planCliInstall({ ...linux, pathEnv: "/usr/bin" }, probe());
    expect(plan.status.message).toBe(CLI_INSTALL_LABELS.notOnPath("/home/u/.local/bin"));
  });

  it("reports a foreign command as a conflict", () => {
    const plan = planCliInstall(linux, probe({ "/home/u/.local/bin/tesseract": "/usr/local/other/tesseract" }));
    expect(plan).toMatchObject({ method: null, status: { state: "conflict" } });
  });

  it("replaces links left by the Monolith app", () => {
    const fromDeb = planCliInstall(linux, probe({ "/home/u/.local/bin/tesseract": "/home/u/.local/share/monolith/bin/tesseract" }));
    expect(fromDeb).toMatchObject({ method: "symlink", status: { state: "missing" } });
    const fromMac = planCliInstall(mac, probe({ "/usr/local/bin/tesseract": "/Applications/Monolith.app/Contents/Resources/bin/tesseract" }));
    expect(fromMac).toMatchObject({ method: "admin-symlink", status: { state: "missing" } });
  });

  it("copies the binary out of an AppImage mount and detects outdated copies", () => {
    const appImage = { ...linux, appImage: true, resourcesPath: "/tmp/.mount_Tesseract/resources" };
    const copy = "/home/u/.local/share/tesseract/bin/tesseract";
    expect(planCliInstall(appImage, probe())).toMatchObject({ method: "copy", copyPath: copy, status: { state: "missing" } });
    const links = { "/home/u/.local/bin/tesseract": copy };
    const binary = "/tmp/.mount_Tesseract/resources/bin/tesseract";
    expect(planCliInstall(appImage, probe(links, { [copy]: 10, [binary]: 10 })).status.state).toBe("installed");
    expect(planCliInstall(appImage, probe(links, { [copy]: 9, [binary]: 10 })).status).toMatchObject({ state: "missing", message: CLI_INSTALL_LABELS.outdated });
  });

  it("uses an admin prompt for /usr/local/bin on macOS", () => {
    expect(planCliInstall(mac, probe())).toMatchObject({ method: "admin-symlink", status: { state: "missing", linkPath: "/usr/local/bin/tesseract" } });
    const installed = probe({ "/usr/local/bin/tesseract": "/Applications/Tesseract.app/Contents/Resources/bin/tesseract" });
    expect(planCliInstall(mac, installed).status.state).toBe("installed");
  });

  it("refuses on macOS when the app runs outside Applications", () => {
    expect(planCliInstall({ ...mac, inApplicationsFolder: false }, probe()).status).toMatchObject({ state: "unsupported", message: CLI_INSTALL_LABELS.translocated });
  });

  it("checks PATH on Windows", () => {
    const win: CliEnvironment = { ...linux, platform: "win32", resourcesPath: "C:\\Users\\u\\AppData\\Local\\Programs\\Tesseract\\resources" };
    expect(planCliInstall({ ...win, pathEnv: "C:\\Windows;c:\\users\\u\\appdata\\local\\programs\\tesseract\\resources\\bin\\" }, probe()).status.state).toBe("installed");
    expect(planCliInstall({ ...win, pathEnv: "C:\\Windows" }, probe()).status).toMatchObject({ state: "unsupported", message: CLI_INSTALL_LABELS.windowsMissing });
  });
});

describe("helpers", () => {
  it("matches PATH entries with trailing slashes", () => {
    expect(pathContains("/a:/home/u/.local/bin/", "/home/u/.local/bin", "linux")).toBe(true);
    expect(pathContains("/a:/b", "/home/u/.local/bin", "linux")).toBe(false);
  });

  it("quotes the admin script safely", () => {
    expect(appleScriptString('a "b" \\c')).toBe('"a \\"b\\" \\\\c"');
    const script = macInstallScript("/Applications/Mono'lith.app/Contents/Resources/bin/tesseract", "/usr/local/bin/tesseract");
    expect(script).toBe(
      `do shell script "mkdir -p '/usr/local/bin' && ln -sfn '/Applications/Mono'\\\\''lith.app/Contents/Resources/bin/tesseract' '/usr/local/bin/tesseract'" with administrator privileges`,
    );
  });
});
