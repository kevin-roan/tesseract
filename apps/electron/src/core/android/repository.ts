import type {
  SdkArchive,
  SdkCatalog,
  SdkHostArch,
  SdkHostOs,
  SdkPackage,
  SystemImageAbi,
  SystemImageOption,
} from "../../shared/contracts/android";
import { ANDROID_VERSION_NAMES, PACKAGE_PATHS, STABLE_CHANNEL, SYSTEM_IMAGE_PATTERN } from "./constants";
import { compareRevisions, formatRevision, parseRevision, revision, type Revision } from "./revision";
import { child, childElements, childText, parseXml, serializeXml, textContent, type XmlElement } from "./xml";

export type RemoteArchive = SdkArchive;

export interface RemotePackage {
  path: string;
  displayName: string;
  revision: Revision;
  licenseId: string | null;
  channel: string;
  dependencies: { path: string; minRevision: string | null }[];
  archives: RemoteArchive[];
  typeDetails: XmlElement | null;
}

export interface ParsedRepository {
  licenses: Record<string, string>;
  packages: RemotePackage[];
}

export interface CatalogPackageExtras {
  typeDetailsXml?: string;
}

export interface HostTarget {
  hostOs: SdkHostOs;
  hostArch: SdkHostArch;
  abi: SystemImageAbi;
}

const HOST_OS_VALUES: readonly SdkHostOs[] = ["linux", "macosx", "windows"];
const HOST_ARCH_VALUES: readonly SdkHostArch[] = ["x64", "aarch64"];

function revisionOf(element: XmlElement | null): Revision | null {
  if (!element) return null;
  const major = childText(element, "major");
  if (major === null) return null;
  const optional = (name: string) => {
    const value = childText(element, name);
    return value === null ? null : Number(value);
  };
  return revision(Number(major), optional("minor"), optional("micro"), optional("preview"));
}

function parseArchive(element: XmlElement, baseUrl: string): RemoteArchive | null {
  const complete = child(element, "complete");
  if (!complete) return null;
  const url = childText(complete, "url");
  const size = Number(childText(complete, "size"));
  const checksum = childElements(complete, "checksum").find((node) => (node.attrs.type ?? "sha1") === "sha1");
  if (!url || !Number.isFinite(size) || !checksum) return null;
  const hostOs = childText(element, "host-os");
  const hostArch = childText(element, "host-arch");
  return {
    url: new URL(url, baseUrl).toString(),
    size,
    sha1: textContent(checksum).trim().toLowerCase(),
    hostOs: hostOs && HOST_OS_VALUES.includes(hostOs as SdkHostOs) ? (hostOs as SdkHostOs) : null,
    hostArch: hostArch && HOST_ARCH_VALUES.includes(hostArch as SdkHostArch) ? (hostArch as SdkHostArch) : null,
  };
}

function isForeignHost(element: XmlElement): boolean {
  const hostOs = childText(element, "host-os");
  const hostArch = childText(element, "host-arch");
  return Boolean(
    (hostOs && !HOST_OS_VALUES.includes(hostOs as SdkHostOs)) || (hostArch && !HOST_ARCH_VALUES.includes(hostArch as SdkHostArch)),
  );
}

function parsePackage(element: XmlElement, baseUrl: string): RemotePackage | null {
  const path = element.attrs.path;
  const parsedRevision = revisionOf(child(element, "revision"));
  if (!path || !parsedRevision) return null;
  const archives = childElements(child(element, "archives") ?? element, "archive")
    .filter((archive) => !isForeignHost(archive))
    .map((archive) => parseArchive(archive, baseUrl))
    .filter((archive): archive is RemoteArchive => archive !== null);
  const dependencies = childElements(child(element, "dependencies") ?? element, "dependency")
    .filter((dependency) => dependency.attrs.path)
    .map((dependency) => {
      const min = revisionOf(child(dependency, "min-revision"));
      return { path: dependency.attrs.path as string, minRevision: min ? formatRevision(min) : null };
    });
  return {
    path,
    displayName: childText(element, "display-name") ?? path,
    revision: parsedRevision,
    licenseId: child(element, "uses-license")?.attrs.ref ?? null,
    channel: child(element, "channelRef")?.attrs.ref ?? STABLE_CHANNEL,
    dependencies,
    archives,
    typeDetails: child(element, "type-details"),
  };
}

export function parseRepository(xml: string, sourceUrl: string): ParsedRepository {
  const root = parseXml(xml);
  const licenses: Record<string, string> = {};
  for (const license of childElements(root, "license")) {
    if (license.attrs.id) licenses[license.attrs.id] = textContent(license).trim();
  }
  const packages = childElements(root, "remotePackage")
    .map((element) => parsePackage(element, sourceUrl))
    .filter((pkg): pkg is RemotePackage => pkg !== null);
  return { licenses, packages };
}

export function archiveFor(pkg: RemotePackage, host: HostTarget): RemoteArchive | null {
  const candidates = pkg.archives.filter(
    (archive) => (archive.hostOs === null || archive.hostOs === host.hostOs) && (archive.hostArch === null || archive.hostArch === host.hostArch),
  );
  return candidates.find((archive) => archive.hostArch === host.hostArch) ?? candidates[0] ?? null;
}

export function latestStable(packages: RemotePackage[], path: string, host: HostTarget): RemotePackage | null {
  return (
    packages
      .filter((pkg) => pkg.path === path && pkg.channel === STABLE_CHANNEL && archiveFor(pkg, host) !== null)
      .sort((a, b) => compareRevisions(b.revision, a.revision))[0] ?? null
  );
}

export function toSdkPackage(pkg: RemotePackage, host: HostTarget): SdkPackage & CatalogPackageExtras {
  const archive = archiveFor(pkg, host);
  if (!archive) throw new Error(`No archive of ${pkg.path} for ${host.hostOs}/${host.hostArch}`);
  const result: SdkPackage & CatalogPackageExtras = {
    path: pkg.path,
    displayName: pkg.displayName,
    revision: formatRevision(pkg.revision),
    licenseId: pkg.licenseId,
    dependencies: pkg.dependencies,
    archive,
  };
  if (pkg.typeDetails) result.typeDetailsXml = serializeXml(pkg.typeDetails);
  return result;
}

export function versionName(api: number): string {
  return ANDROID_VERSION_NAMES[Math.floor(api)] ?? `API ${api}`;
}

export function systemImageApi(path: string): { api: number; abi: string } | null {
  const match = SYSTEM_IMAGE_PATTERN.exec(path);
  if (!match) return null;
  return { api: Number(`${match[1]}${match[2] ?? ""}`), abi: match[3] as string };
}

export function systemImageOptions(packages: RemotePackage[], host: HostTarget): SystemImageOption[] {
  const paths = new Set(packages.map((pkg) => pkg.path).filter((path) => systemImageApi(path)?.abi === host.abi));
  const options: SystemImageOption[] = [];
  for (const path of paths) {
    const pkg = latestStable(packages, path, host);
    const parsed = systemImageApi(path);
    if (!pkg || !parsed) continue;
    options.push({ ...toSdkPackage(pkg, host), api: parsed.api, versionName: versionName(parsed.api), abi: host.abi });
  }
  return options.sort((a, b) => b.api - a.api || a.path.localeCompare(b.path));
}

export function buildCatalog(repository: ParsedRepository, images: ParsedRepository, host: HostTarget, fetchedAt: string, missing: (path: string) => string): SdkCatalog {
  const pick = (path: string) => {
    const pkg = latestStable(repository.packages, path, host);
    if (!pkg) throw new Error(missing(path));
    return toSdkPackage(pkg, host);
  };
  const emulator = pick(PACKAGE_PATHS.emulator);
  const platformTools = pick(PACKAGE_PATHS.platformTools);
  const systemImages = systemImageOptions(images.packages, host);
  const allLicenses = { ...images.licenses, ...repository.licenses };
  const licenses: Record<string, string> = {};
  for (const pkg of [emulator, platformTools, ...systemImages]) {
    if (pkg.licenseId && allLicenses[pkg.licenseId] !== undefined) licenses[pkg.licenseId] = allLicenses[pkg.licenseId] as string;
  }
  return { fetchedAt, emulator, platformTools, systemImages, licenses };
}

export function catalogPackages(catalog: SdkCatalog): SdkPackage[] {
  return [catalog.platformTools, catalog.emulator, ...catalog.systemImages];
}

export function findCatalogPackage(catalog: SdkCatalog, path: string): SdkPackage | null {
  return catalogPackages(catalog).find((pkg) => pkg.path === path) ?? null;
}

export function defaultSystemImage(catalog: SdkCatalog, api: number): SystemImageOption | null {
  return catalog.systemImages.find((image) => image.api === api) ?? catalog.systemImages[0] ?? null;
}

export function emulatorRequirement(pkg: SdkPackage): string | null {
  return pkg.dependencies.find((dependency) => dependency.path === PACKAGE_PATHS.emulator)?.minRevision ?? null;
}

export function satisfies(installed: string | null, minimum: string | null): boolean {
  if (minimum === null) return true;
  if (installed === null) return false;
  const left = parseRevision(installed);
  const right = parseRevision(minimum);
  return Boolean(left && right && compareRevisions(left, right) >= 0);
}
