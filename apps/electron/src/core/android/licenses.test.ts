import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANDROID_REPOSITORY_URL, ANDROID_SYSIMG_URL } from "./constants";
import { acceptLicense, isLicenseAccepted, licenseHash, normalizeLicenseText, pendingLicenses } from "./licenses";
import { parseRepository } from "./repository";
import { fixture, tempDir } from "./test-support";
import type { SdkCatalog } from "../../shared/contracts/android";

const SDKMANAGER_HASHES = {
  "android-sdk-license": "24333f8a63b6825ea9c5514f83c2829b004d1fee",
  "android-sdk-preview-license": "84831b9409646a918e30573bab4c9c91346d8abd",
  "android-sdk-arm-dbt-license": "859f317696f67ef3d7f30a50a5560e7834b43903",
};

async function licenses() {
  return {
    ...parseRepository(await fixture("sys-img2-3.xml"), ANDROID_SYSIMG_URL).licenses,
    ...parseRepository(await fixture("repository2-3.xml"), ANDROID_REPOSITORY_URL).licenses,
  };
}

describe("license hashes", () => {
  it("match the hashes sdkmanager writes", async () => {
    const texts = await licenses();
    for (const [id, hash] of Object.entries(SDKMANAGER_HASHES)) expect(licenseHash(texts[id]!)).toBe(hash);
  });

  it("normalize like sdkmanager's TrimStringAdapter", () => {
    expect(normalizeLicenseText("  a\n  b\n\nc   d \n")).toBe("a b\n\nc d");
    expect(licenseHash("  x  ")).toBe(licenseHash("x"));
  });
});

describe("acceptLicense", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
  });
  afterEach(() => cleanup());

  it("appends the hash on a new line and keeps existing lines", async () => {
    const text = (await licenses())["android-sdk-license"]!;
    await mkdir(join(dir, "licenses"));
    await writeFile(join(dir, "licenses", "android-sdk-license"), "\nd56f5187479451eabf01fb78af6dfcb131a6481e");
    expect(await isLicenseAccepted(dir, "android-sdk-license", text)).toBe(false);
    await acceptLicense(dir, "android-sdk-license", text);
    await acceptLicense(dir, "android-sdk-license", text);
    expect(await readFile(join(dir, "licenses", "android-sdk-license"), "utf8")).toBe(
      "\nd56f5187479451eabf01fb78af6dfcb131a6481e\n24333f8a63b6825ea9c5514f83c2829b004d1fee",
    );
    expect(await isLicenseAccepted(dir, "android-sdk-license", text)).toBe(true);
  });

  it("creates the licenses directory and reports pending ids", async () => {
    const texts = await licenses();
    const catalog = { licenses: { "android-sdk-license": texts["android-sdk-license"]!, "android-sdk-arm-dbt-license": texts["android-sdk-arm-dbt-license"]! } } as unknown as SdkCatalog;
    const packages = [
      { licenseId: "android-sdk-license" },
      { licenseId: "android-sdk-arm-dbt-license" },
      { licenseId: "android-sdk-license" },
      { licenseId: null },
    ] as SdkCatalog["systemImages"];
    expect(await pendingLicenses(dir, catalog, packages)).toEqual(["android-sdk-license", "android-sdk-arm-dbt-license"]);
    await acceptLicense(dir, "android-sdk-arm-dbt-license", texts["android-sdk-arm-dbt-license"]!);
    expect(await readFile(join(dir, "licenses", "android-sdk-arm-dbt-license"), "utf8")).toBe(`\n${SDKMANAGER_HASHES["android-sdk-arm-dbt-license"]}`);
    expect(await pendingLicenses(dir, catalog, packages)).toEqual(["android-sdk-license"]);
  });

  it("rejects unsafe license ids", async () => {
    await expect(acceptLicense(dir, "../evil", "x")).rejects.toThrow();
  });
});
