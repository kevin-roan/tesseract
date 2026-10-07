import { describe, expect, it } from "vitest";
import { CLI_INSTALL_LABELS } from "../labels";
import { appleScriptString, macInstallScript, pathContains, planCliInstall, type CliEnvironment, type CliProbe } from "./cli-plan";

const linux: CliEnvironment = {
  platform: "linux",
  packaged: true,
  resourcesPath: "/opt/Monolith/resources",
  home: "/home/u",
  pathEnv: "/usr/bin:/home/u/.local/bin",
  appImage: false,
  inApplicationsFolder: true,
};
const mac: CliEnvironment = { ...linux, platform: "darwin", resourcesPath: "/Applications/Monolith.app/Contents/Resources", home: "/Users/u" };

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
    const plan = planCliInstall(linux, probe({ "/usr/bin/monolith": "/opt/Monolith/resources/bin/monolith" }));
    expect(plan.status).toMatchObject({ state: "installed", linkPath: "/usr/bin/monolith" });
  });

  it("links ~/.local/bin/monolith when nothing is installed", () => {
    const plan = planCliInstall(linux, probe());
    expect(plan).toMatchObject({ method: "symlink", copyPath: null, status: { state: "missing", linkPath: "/home/u/.local/bin/monolith", message: null } });
  });

  it("warns when ~/.local/bin is not on PATH", () => {
    const plan = planCliInstall({ ...linux, pathEnv: "/usr/bin" }, probe());
    expect(plan.status.message).toBe(CLI_INSTALL_LABELS.notOnPath("/home/u/.local/bin"));
  });

  it("reports a foreign command as a conflict", () => {
    const plan = planCliInstall(linux, probe({ "/home/u/.local/bin/monolith": "/usr/local/other/monolith" }));
    expect(plan).toMatchObject({ method: null, status: { state: "conflict" } });
  });

  it("copies the binary out of an AppImage mount and detects outdated copies", () => {
    const appImage = { ...linux, appImage: true, resourcesPath: "/tmp/.mount_Monolith/resources" };
    const copy = "/home/u/.local/share/monolith/bin/monolith";
    expect(planCliInstall(appImage, probe())).toMatchObject({ method: "copy", copyPath: copy, status: { state: "missing" } });
    const links = { "/home/u/.local/bin/monolith": copy };
    const binary = "/tmp/.mount_Monolith/resources/bin/monolith";
    expect(planCliInstall(appImage, probe(links, { [copy]: 10, [binary]: 10 })).status.state).toBe("installed");
    expect(planCliInstall(appImage, probe(links, { [copy]: 9, [binary]: 10 })).status).toMatchObject({ state: "missing", message: CLI_INSTALL_LABELS.outdated });
  });

  it("uses an admin prompt for /usr/local/bin on macOS", () => {
    expect(planCliInstall(mac, probe())).toMatchObject({ method: "admin-symlink", status: { state: "missing", linkPath: "/usr/local/bin/monolith" } });
    const installed = probe({ "/usr/local/bin/monolith": "/Applications/Monolith.app/Contents/Resources/bin/monolith" });
    expect(planCliInstall(mac, installed).status.state).toBe("installed");
  });

  it("refuses on macOS when the app runs outside Applications", () => {
    expect(planCliInstall({ ...mac, inApplicationsFolder: false }, probe()).status).toMatchObject({ state: "unsupported", message: CLI_INSTALL_LABELS.translocated });
  });

  it("checks PATH on Windows", () => {
    const win: CliEnvironment = { ...linux, platform: "win32", resourcesPath: "C:\\Users\\u\\AppData\\Local\\Programs\\Monolith\\resources" };
    expect(planCliInstall({ ...win, pathEnv: "C:\\Windows;c:\\users\\u\\appdata\\local\\programs\\monolith\\resources\\bin\\" }, probe()).status.state).toBe("installed");
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
    const script = macInstallScript("/Applications/Mono'lith.app/Contents/Resources/bin/monolith", "/usr/local/bin/monolith");
    expect(script).toBe(
      `do shell script "mkdir -p '/usr/local/bin' && ln -sfn '/Applications/Mono'\\\\''lith.app/Contents/Resources/bin/monolith' '/usr/local/bin/monolith'" with administrator privileges`,
    );
  });
});
