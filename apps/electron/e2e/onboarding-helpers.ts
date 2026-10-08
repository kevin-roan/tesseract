import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATALOG_CACHE_FILES } from "../src/core/android/constants";
import { buildZip, serveFiles, sha1, type FileServer } from "../src/core/android/test-support";
import { SANDBOX_PREFIX } from "../scripts/lib/electron.ts";

export const REAL_SERVICES_ENV = {
  TESSERACT_FIXTURES: "0",
  TESSERACT_DISABLE_DISCOVERY: "1",
  TESSERACT_DESKTOP_URL: "",
  TESSERACT_DESKTOP_NAME: "",
  TESSERACT_DESKTOP_PAIRING_URL: "",
  TESSERACT_TOKEN: "",
} as const;

export const FIXTURE_ANDROID = {
  api: 36,
  olderApi: 35,
  abi: "x86_64",
  avd: "Tesseract_API_36",
  license: "android-sdk-license",
  licenseText: "Terms and Conditions\n\nThis is the fixture Android SDK License Agreement used by the e2e suite.",
  emulatorRevision: { major: 37, minor: 2, micro: 12 },
  platformToolsRevision: { major: 37, minor: 0, micro: 1 },
  imageRevision: 7,
} as const;

const FAKE_EMULATOR = [
  "#!/bin/sh",
  'case "$1" in',
  '  -list-avds) for f in "$HOME"/.android/avd/*.ini; do [ -e "$f" ] && basename "$f" .ini; done ;;',
  "  -accel-check) printf 'accel:\\n0\\nKVM (version 12) is installed and usable.\\naccel\\n' ;;",
  "esac",
  "exit 0",
  "",
].join("\n");

const ARCHIVES = {
  "platform-tools.zip": () =>
    buildZip([
      { name: "platform-tools/" },
      { name: "platform-tools/adb", data: "#!/bin/sh\nexit 0\n", mode: 0o100755 },
      { name: "platform-tools/source.properties", data: "Pkg.Revision=37.0.1\n" },
    ]),
  "emulator.zip": () =>
    buildZip([
      { name: "emulator/" },
      { name: "emulator/emulator", data: FAKE_EMULATOR, mode: 0o100755 },
      { name: "emulator/source.properties", data: "Pkg.Revision=37.2.12\n" },
    ]),
  "x86_64-36_r07.zip": () =>
    buildZip([
      { name: "x86_64/" },
      { name: "x86_64/system.img", data: "system" },
      { name: "x86_64/build.prop", data: "ro.build.version.sdk=36\n" },
    ]),
  "x86_64-35_r09.zip": () =>
    buildZip([
      { name: "x86_64/" },
      { name: "x86_64/system.img", data: "system" },
      { name: "x86_64/build.prop", data: "ro.build.version.sdk=35\n" },
    ]),
} as const;

type ArchiveName = keyof typeof ARCHIVES;

interface Revision {
  major: number;
  minor?: number;
  micro?: number;
}

function revisionXml(revision: Revision, tag = "revision"): string {
  const parts = Object.entries(revision).map(([key, value]) => `<${key}>${value}</${key}>`);
  return `<${tag}>${parts.join("")}</${tag}>`;
}

function archiveXml(base: string, name: ArchiveName, data: Buffer, hostOs: string | null): string {
  const host = hostOs ? `<host-os>${hostOs}</host-os>` : "";
  return `<archives><archive><complete><size>${data.length}</size><checksum type="sha1">${sha1(data)}</checksum><url>${base}/${name}</url></complete>${host}</archive></archives>`;
}

function licenseXml(): string {
  return `<license id="${FIXTURE_ANDROID.license}" type="text">${FIXTURE_ANDROID.licenseText}</license>`;
}

function repositoryXml(base: string, zips: Record<ArchiveName, Buffer>): string {
  const pkg = (path: string, name: string, revision: Revision, archive: ArchiveName, hostOs: string | null) =>
    `<remotePackage path="${path}">${revisionXml(revision)}<display-name>${name}</display-name><uses-license ref="${FIXTURE_ANDROID.license}"/><channelRef ref="channel-0"/>${archiveXml(base, archive, zips[archive], hostOs)}</remotePackage>`;
  return [
    "<?xml version='1.0' encoding='utf-8'?>",
    '<sdk:sdk-repository xmlns:sdk="http://schemas.android.com/sdk/android/repo/repository2/03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    licenseXml(),
    '<channel id="channel-0">stable</channel>',
    pkg("platform-tools", "Android SDK Platform-Tools", FIXTURE_ANDROID.platformToolsRevision, "platform-tools.zip", "linux"),
    pkg("emulator", "Android Emulator", FIXTURE_ANDROID.emulatorRevision, "emulator.zip", "linux"),
    "</sdk:sdk-repository>",
    "",
  ].join("\n");
}

function systemImagesXml(base: string, zips: Record<ArchiveName, Buffer>): string {
  const image = (api: number, revision: number, archive: ArchiveName) =>
    [
      `<remotePackage path="system-images;android-${api};google_apis;${FIXTURE_ANDROID.abi}">`,
      `<type-details xsi:type="sys-img:sysImgDetailsType"><api-level>${api}</api-level><tag><id>google_apis</id><display>Google APIs</display></tag><vendor><id>google</id><display>Google Inc.</display></vendor><abi>${FIXTURE_ANDROID.abi}</abi></type-details>`,
      revisionXml({ major: revision }),
      "<display-name>Google APIs Intel x86_64 Atom System Image</display-name>",
      `<uses-license ref="${FIXTURE_ANDROID.license}"/>`,
      `<dependencies><dependency path="emulator">${revisionXml({ major: 35, minor: 4, micro: 9 }, "min-revision")}</dependency></dependencies>`,
      '<channelRef ref="channel-0"/>',
      archiveXml(base, archive, zips[archive], null),
      "</remotePackage>",
    ].join("");
  return [
    "<?xml version='1.0' encoding='utf-8'?>",
    '<sys-img:sdk-sys-img xmlns:sys-img="http://schemas.android.com/sdk/android/repo/sys-img2/03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    licenseXml(),
    '<channel id="channel-0">stable</channel>',
    image(FIXTURE_ANDROID.api, FIXTURE_ANDROID.imageRevision, "x86_64-36_r07.zip"),
    image(FIXTURE_ANDROID.olderApi, 9, "x86_64-35_r09.zip"),
    "</sys-img:sdk-sys-img>",
    "",
  ].join("\n");
}

export interface AndroidRepositoryFixture {
  server: FileServer;
  repositoryUrl: string;
  systemImagesUrl: string;
  repositoryXml: string;
  systemImagesXml: string;
  close(): Promise<void>;
}

export async function serveAndroidRepository(): Promise<AndroidRepositoryFixture> {
  const zips = Object.fromEntries(Object.entries(ARCHIVES).map(([name, build]) => [name, build()])) as Record<ArchiveName, Buffer>;
  const files: Record<string, Buffer> = { ...zips };
  const server = await serveFiles(files);
  const repository = repositoryXml(server.url, zips);
  const images = systemImagesXml(server.url, zips);
  files[CATALOG_CACHE_FILES.repository] = Buffer.from(repository);
  files[CATALOG_CACHE_FILES.systemImages] = Buffer.from(images);
  return {
    server,
    repositoryUrl: `${server.url}/${CATALOG_CACHE_FILES.repository}`,
    systemImagesUrl: `${server.url}/${CATALOG_CACHE_FILES.systemImages}`,
    repositoryXml: repository,
    systemImagesXml: images,
    close: () => server.close(),
  };
}

export interface AndroidProfile {
  dir: string;
  home: string;
  userData: string;
  sdkRoot: string;
  avdHome: string;
  env: Record<string, string>;
  dispose(): void;
}

export function androidProfile(repository: AndroidRepositoryFixture, hostShellPort: number): AndroidProfile {
  const dir = mkdtempSync(join(tmpdir(), `${SANDBOX_PREFIX}android-`));
  const home = join(dir, "home");
  const userData = join(dir, "user-data");
  mkdirSync(home, { recursive: true });
  mkdirSync(userData, { recursive: true });
  return {
    dir,
    home,
    userData,
    sdkRoot: join(home, ".local", "share", "tesseract", "android-sdk"),
    avdHome: join(home, ".android", "avd"),
    env: {
      HOME: home,
      TESSERACT_USER_DATA: userData,
      TESSERACT_ANDROID_REPOSITORY_URL: repository.repositoryUrl,
      TESSERACT_ANDROID_SYSIMG_URL: repository.systemImagesUrl,
      TESSERACT_ANDROID_SDK_ROOT: "",
      ANDROID_SDK_ROOT: "",
      ANDROID_HOME: "",
      ANDROID_AVD_HOME: "",
      ANDROID_USER_HOME: "",
      TESSERACT_HOST_SHELL_PORT: String(hostShellPort),
      TESSERACT_HOST_SHELL_DIR: join(dir, "host-shell"),
    },
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function readJson<T = Record<string, unknown>>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

export interface LocalDocker {
  serverVersion: string;
  compose: string | null;
}

function dockerOutput(args: string[]): string | null {
  try {
    return execFileSync("docker", args, { encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

export function localDocker(): LocalDocker | null {
  const serverVersion = dockerOutput(["version", "--format", "{{.Server.Version}}"]);
  if (!serverVersion) return null;
  return { serverVersion, compose: dockerOutput(["compose", "version", "--short"])?.replace(/^v/, "") ?? null };
}

export interface LiveStack {
  url: string;
  token: string;
}

export function liveStack(): LiveStack | null {
  const url = process.env.TESSERACT_E2E_URL;
  if (!url) return null;
  return { url, token: process.env.TESSERACT_E2E_TOKEN ?? "" };
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
