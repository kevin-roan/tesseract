import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SdkCatalog, SdkPackage } from "../../shared/contracts/android";
import { LICENSES_DIR } from "./constants";

export function normalizeLicenseText(text: string): string {
  return text
    .replace(/(?<=\s)[ \t]*/g, "")
    .replace(/(?<!\n)\n(?!\n)/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

export function licenseHash(text: string): string {
  return createHash("sha1").update(normalizeLicenseText(text), "utf8").digest("hex");
}

export function licenseFile(sdkRoot: string, licenseId: string): string {
  return join(sdkRoot, LICENSES_DIR, licenseId);
}

async function acceptedHashes(sdkRoot: string, licenseId: string): Promise<string[]> {
  try {
    return (await readFile(licenseFile(sdkRoot, licenseId), "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function isLicenseAccepted(sdkRoot: string, licenseId: string, text: string): Promise<boolean> {
  return (await acceptedHashes(sdkRoot, licenseId)).includes(licenseHash(text));
}

export async function acceptLicense(sdkRoot: string, licenseId: string, text: string): Promise<void> {
  if (!/^[A-Za-z0-9._-]+$/.test(licenseId)) throw new Error(`Invalid license id ${licenseId}`);
  const hash = licenseHash(text);
  const existing = await acceptedHashes(sdkRoot, licenseId);
  if (existing.includes(hash)) return;
  await mkdir(join(sdkRoot, LICENSES_DIR), { recursive: true });
  let current = "";
  try {
    current = await readFile(licenseFile(sdkRoot, licenseId), "utf8");
  } catch {
    current = "";
  }
  await writeFile(licenseFile(sdkRoot, licenseId), `${current}\n${hash}`);
}

export async function pendingLicenses(sdkRoot: string, catalog: SdkCatalog, packages: readonly SdkPackage[]): Promise<string[]> {
  const ids = [...new Set(packages.map((pkg) => pkg.licenseId).filter((id): id is string => id !== null))];
  const pending: string[] = [];
  for (const id of ids) {
    const text = catalog.licenses[id];
    if (text === undefined || !(await isLicenseAccepted(sdkRoot, id, text))) pending.push(id);
  }
  return pending;
}
