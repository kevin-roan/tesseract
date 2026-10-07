import { describe, expect, it } from "vitest";
import {
  classifyDaemonError,
  cleanVersion,
  compareVersions,
  decodeWslOutput,
  formatGb,
  isSupportedWindowsBuild,
  kindFromContext,
  parseBuildxVersion,
  parseChecksums,
  parseCliVersion,
  parseGetentMembers,
  parseGetentName,
  parseInfoJson,
  parseMinimumSystemVersion,
  parseOsRelease,
  parseServiceState,
  parseVersionJson,
  parseVirtualization,
  parseWslVersion,
  windowsBuild,
} from "./parse";
import {
  APPCAST,
  CLI_VERSION,
  INFO_JSON_DESKTOP,
  INFO_JSON_ENGINE,
  INFO_JSON_ROOTLESS,
  MAC_CHECKSUMS,
  OS_RELEASE_UBUNTU,
  PERMISSION_ERROR,
  PODMAN_VERSION,
  STOPPED_ERROR,
  VERSION_JSON_ENGINE,
  VERSION_JSON_NO_SERVER,
  WIN_CHECKSUMS,
  WINDOWS_STOPPED_ERROR,
  utf16,
} from "./testing/fixtures";

describe("versions", () => {
  it("cleans and compares versions", () => {
    expect(cleanVersion("v2.39.2-desktop.1")).toBe("2.39.2");
    expect(cleanVersion("5.5.1\n")).toBe("5.5.1");
    expect(cleanVersion("garbage")).toBeNull();
    expect(compareVersions("2.24.0", "2.24")).toBe(0);
    expect(compareVersions("5.5.1", "2.24.0")).toBe(1);
    expect(compareVersions("2.20.3", "2.24.0")).toBe(-1);
    expect(compareVersions("2.6.1.0", "2.1.5")).toBe(1);
  });

  it("parses the CLI version and spots the podman shim", () => {
    expect(parseCliVersion(CLI_VERSION)).toEqual({ version: "29.8.1", podman: false });
    expect(parseCliVersion(PODMAN_VERSION)).toEqual({ version: "5.2.3", podman: true });
    expect(parseCliVersion("")).toBeNull();
  });

  it("parses buildx versions", () => {
    expect(parseBuildxVersion("github.com/docker/buildx v0.35.0 a319e5b")).toBe("0.35.0");
  });
});

describe("docker version / info", () => {
  it("reads the server from docker version", () => {
    expect(parseVersionJson(VERSION_JSON_ENGINE)).toEqual({
      server: { version: "29.8.1", os: "linux", arch: "amd64", podman: false },
      context: "default",
    });
    expect(parseVersionJson(VERSION_JSON_NO_SERVER)).toEqual({ server: null, context: "default" });
    expect(parseVersionJson("not json")).toEqual({ server: null, context: null });
  });

  it("detects a podman server component", () => {
    const json = JSON.stringify({ Client: {}, Server: { Version: "5.2.3", Os: "linux", Arch: "amd64", Components: [{ Name: "Podman Engine" }] } });
    expect(parseVersionJson(json).server?.podman).toBe(true);
  });

  it("reads info for engine, desktop and rootless", () => {
    expect(parseInfoJson(INFO_JSON_ENGINE)).toMatchObject({
      desktop: false,
      rootless: false,
      ncpu: 16,
      compose: "5.5.1",
      buildx: "0.35.0",
    });
    expect(parseInfoJson(INFO_JSON_DESKTOP)).toMatchObject({ desktop: true, compose: "2.39.2", buildx: "0.28.0" });
    expect(parseInfoJson(INFO_JSON_ROOTLESS)).toMatchObject({ rootless: true, rootDir: "/home/dev/.local/share/docker" });
  });

  it("classifies daemon errors", () => {
    expect(classifyDaemonError(PERMISSION_ERROR, false)).toBe("permission");
    expect(classifyDaemonError(STOPPED_ERROR, false)).toBe("stopped");
    expect(classifyDaemonError(WINDOWS_STOPPED_ERROR, false)).toBe("stopped");
    expect(classifyDaemonError("something else", false)).toBe("stopped");
    expect(classifyDaemonError("", true)).toBe("unresponsive");
  });

  it("maps contexts to engine kinds", () => {
    expect(kindFromContext("desktop-linux")).toBe("desktop");
    expect(kindFromContext("colima")).toBe("colima");
    expect(kindFromContext("orbstack")).toBe("orbstack");
    expect(kindFromContext("default")).toBeNull();
  });
});

describe("host details", () => {
  it("decodes UTF-16 and UTF-8 WSL output", () => {
    const text = "﻿WSL version: 2.6.1.0\r\nKernel version: 6.6.87.2-1\r\n";
    expect(parseWslVersion(decodeWslOutput(utf16(text)))).toBe("2.6.1.0");
    expect(parseWslVersion(decodeWslOutput(Buffer.from("WSL-Version: 2.0.9.0\n").toString("latin1")))).toBe("2.0.9.0");
    expect(parseWslVersion("")).toBeNull();
  });

  it("reads virtualization flags", () => {
    expect(parseVirtualization("False\r\nTrue\r\n")).toBe(true);
    expect(parseVirtualization("False\r\nFalse\r\n")).toBe(false);
    expect(parseVirtualization("")).toBeNull();
  });

  it("parses os-release", () => {
    expect(parseOsRelease(OS_RELEASE_UBUNTU)).toEqual({
      id: "ubuntu",
      idLike: ["debian"],
      versionId: "24.04",
      prettyName: "Ubuntu 24.04.1 LTS",
    });
  });

  it("parses getent and systemctl output", () => {
    expect(parseGetentMembers("docker:x:961:xtan,other\n")).toEqual(["xtan", "other"]);
    expect(parseGetentMembers("docker:x:961:\n")).toEqual([]);
    expect(parseGetentName("docker:x:961:xtan")).toBe("docker");
    expect(parseServiceState(0, "active\n")).toBe(true);
    expect(parseServiceState(3, "inactive\n")).toBe(false);
    expect(parseServiceState(4, "")).toBeNull();
  });

  it("checks Windows builds", () => {
    expect(windowsBuild("10.0.22631")).toBe(22631);
    expect(isSupportedWindowsBuild(19045)).toBe(true);
    expect(isSupportedWindowsBuild(19044)).toBe(false);
    expect(isSupportedWindowsBuild(22621)).toBe(false);
    expect(isSupportedWindowsBuild(26100)).toBe(true);
  });

  it("formats memory like the GTK app", () => {
    expect(formatGb(20562128896)).toBe("19");
    expect(formatGb(6 * 1024 ** 3)).toBe("6");
    expect(formatGb(3.5 * 1024 ** 3)).toBe("3.5");
  });
});

describe("downloads metadata", () => {
  it("reads published checksums for mac and windows", () => {
    expect(parseChecksums(MAC_CHECKSUMS, "Docker.dmg")).toBe("02147e4d559ff41e1d9d7be63a554101340237064c7b6df234548aa111ebf04c");
    expect(parseChecksums(WIN_CHECKSUMS, "Docker Desktop Installer.exe")).toMatch(/^a9814e31/);
    expect(parseChecksums(WIN_CHECKSUMS, "Docker.dmg")).toBeNull();
  });

  it("reads the appcast minimum macOS", () => {
    expect(parseMinimumSystemVersion(APPCAST)).toBe("14.0.0");
    expect(parseMinimumSystemVersion("<rss/>")).toBeNull();
  });
});
