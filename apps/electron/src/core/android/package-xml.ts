import type { SdkPackage } from "../../shared/contracts/android";
import { normalizeLicenseText } from "./licenses";
import type { CatalogPackageExtras } from "./repository";
import { parseRevision } from "./revision";
import { escapeXml, parseXml, serializeXml, type XmlElement } from "./xml";

const NAMESPACES = {
  common: "http://schemas.android.com/repository/android/common/02",
  generic: "http://schemas.android.com/repository/android/generic/02",
  sysImg: "http://schemas.android.com/sdk/android/repo/sys-img2/03",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
} as const;

const INDENT = "    ";

function revisionXml(text: string): string {
  const parsed = parseRevision(text);
  if (!parsed) return "<revision><major>0</major></revision>";
  const parts = [`<major>${parsed.major}</major>`];
  if (parsed.minor !== null) parts.push(`<minor>${parsed.minor}</minor>`);
  if (parsed.micro !== null) parts.push(`<micro>${parsed.micro}</micro>`);
  if (parsed.preview !== null) parts.push(`<preview>${parsed.preview}</preview>`);
  return `<revision>${parts.join("")}</revision>`;
}

function systemImageDetails(pkg: SdkPackage & CatalogPackageExtras & { api?: number; abi?: string }): XmlElement[] {
  if (pkg.typeDetailsXml) {
    try {
      return parseXml(pkg.typeDetailsXml).children.filter((node): node is XmlElement => typeof node !== "string");
    } catch {
      return [];
    }
  }
  const [, platform = "", tag = "", abi = pkg.abi ?? ""] = pkg.path.split(";");
  const element = (name: string, text: string, children: XmlElement[] = []): XmlElement => ({
    name,
    qname: name,
    attrs: {},
    children: children.length ? children : [text],
  });
  return [
    element("api-level", platform.replace(/^android-/, "")),
    element("tag", "", [element("id", tag), element("display", "Google APIs")]),
    element("vendor", "", [element("id", "google"), element("display", "Google Inc.")]),
    element("abi", abi),
  ];
}

function typeDetailsXml(pkg: SdkPackage & CatalogPackageExtras): string {
  const open = `<type-details xmlns:xsi="${NAMESPACES.xsi}"`;
  if (!pkg.path.startsWith("system-images;")) return `${INDENT}${open} xsi:type="ns5:genericDetailsType"/>`;
  const children = systemImageDetails(pkg)
    .map((node) => serializeXml(node, `${INDENT}${INDENT}`, INDENT))
    .join("\n");
  return `${INDENT}${open} xsi:type="ns13:sysImgDetailsType">\n${children}\n${INDENT}</type-details>`;
}

export function packageXml(pkg: SdkPackage & CatalogPackageExtras, licenseText: string | null): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<ns2:repository xmlns:ns2="${NAMESPACES.common}" xmlns:ns5="${NAMESPACES.generic}" xmlns:ns13="${NAMESPACES.sysImg}">`,
  ];
  if (pkg.licenseId && licenseText !== null) {
    lines.push(`  <license id="${escapeXml(pkg.licenseId)}" type="text">${escapeXml(normalizeLicenseText(licenseText))}</license>`);
  }
  lines.push(`  <localPackage path="${escapeXml(pkg.path)}" obsolete="false">`);
  lines.push(typeDetailsXml(pkg));
  lines.push(`${INDENT}${revisionXml(pkg.revision)}`);
  lines.push(`${INDENT}<display-name>${escapeXml(pkg.displayName)}</display-name>`);
  if (pkg.licenseId) lines.push(`${INDENT}<uses-license ref="${escapeXml(pkg.licenseId)}"/>`);
  if (pkg.dependencies.length > 0) {
    lines.push(`${INDENT}<dependencies>`);
    for (const dependency of pkg.dependencies) {
      const min = dependency.minRevision ? revisionXml(dependency.minRevision).replace(/^<revision>|<\/revision>$/g, "") : null;
      lines.push(
        min
          ? `${INDENT}${INDENT}<dependency path="${escapeXml(dependency.path)}"><min-revision>${min}</min-revision></dependency>`
          : `${INDENT}${INDENT}<dependency path="${escapeXml(dependency.path)}"/>`,
      );
    }
    lines.push(`${INDENT}</dependencies>`);
  }
  lines.push("  </localPackage>", "</ns2:repository>", "");
  return lines.join("\n");
}
