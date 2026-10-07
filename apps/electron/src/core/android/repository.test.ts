import { describe, expect, it } from "vitest";
import { ANDROID_REPOSITORY_URL, ANDROID_SYSIMG_URL } from "./constants";
import { buildCatalog, emulatorRequirement, parseRepository, satisfies, systemImageApi, versionName, type HostTarget } from "./repository";
import { compareRevisionStrings, formatRevision, parseRevision } from "./revision";
import { fixture } from "./test-support";
import { child, childText, parseXml, serializeXml, textContent } from "./xml";

const LINUX: HostTarget = { hostOs: "linux", hostArch: "x64", abi: "x86_64" };
const MAC_ARM: HostTarget = { hostOs: "macosx", hostArch: "aarch64", abi: "arm64-v8a" };
const WINDOWS: HostTarget = { hostOs: "windows", hostArch: "x64", abi: "x86_64" };

async function parsed() {
  return {
    repository: parseRepository(await fixture("repository2-3.xml"), ANDROID_REPOSITORY_URL),
    images: parseRepository(await fixture("sys-img2-3.xml"), ANDROID_SYSIMG_URL),
  };
}

async function catalogFor(host: HostTarget) {
  const { repository, images } = await parsed();
  return buildCatalog(repository, images, host, "2026-10-07T00:00:00.000Z", (path) => `missing ${path}`);
}

describe("xml", () => {
  it("parses namespaced elements, attributes, entities, CDATA and comments", () => {
    const root = parseXml(
      `<?xml version="1.0"?><!-- c --><a:root xmlns:a="urn:x" a:kind='k &amp; v'><a:item id="1">x &lt; y &#65;&#x42;</a:item><![CDATA[<raw>]]><empty/></a:root>`,
    );
    expect(root.name).toBe("root");
    expect(root.attrs).toEqual({ kind: "k & v" });
    expect(childText(root, "item")).toBe("x < y AB");
    expect(child(root, "item")?.attrs.id).toBe("1");
    expect(textContent(root)).toContain("<raw>");
    expect(child(root, "empty")?.children).toEqual([]);
  });

  it("handles > inside attribute values and rejects mismatched tags", () => {
    expect(parseXml(`<r a="1>2"><b/></r>`).attrs.a).toBe("1>2");
    expect(() => parseXml("<r><b></r>")).toThrow();
    expect(() => parseXml("<r>")).toThrow();
  });

  it("serializes an element tree with local names", () => {
    const root = parseXml(`<t:x xmlns:t="urn"><t:y>1 &amp; 2</t:y><z k="v"/></t:x>`);
    expect(serializeXml(root)).toBe(`<x>\n  <y>1 &amp; 2</y>\n  <z k="v"/>\n</x>`);
  });
});

describe("revisions", () => {
  it("parses, formats and compares", () => {
    expect(formatRevision(parseRevision("37.2.12")!)).toBe("37.2.12");
    expect(formatRevision(parseRevision("7")!)).toBe("7");
    expect(formatRevision(parseRevision("35.4.9 rc2")!)).toBe("35.4.9 rc2");
    expect(compareRevisionStrings("37.2.12", "37.3.3")).toBeLessThan(0);
    expect(compareRevisionStrings("37.0.0", "37")).toBe(0);
    expect(compareRevisionStrings("36.0.0 rc1", "36.0.0")).toBeLessThan(0);
    expect(satisfies("37.2.12", "35.4.9")).toBe(true);
    expect(satisfies("35.4.8", "35.4.9")).toBe(false);
    expect(satisfies(null, "35.4.9")).toBe(false);
    expect(satisfies(null, null)).toBe(true);
  });
});

describe("parseRepository", () => {
  it("reads licenses and every remote package with archives and channels", async () => {
    const { repository, images } = await parsed();
    expect(Object.keys(repository.licenses)).toEqual(["android-sdk-license", "android-sdk-preview-license"]);
    expect(repository.licenses["android-sdk-license"]?.startsWith("Terms and Conditions")).toBe(true);
    expect(repository.packages.map((pkg) => `${pkg.path}@${formatRevision(pkg.revision)}/${pkg.channel}`)).toEqual([
      "platform-tools@37.0.1/channel-0",
      "emulator@37.3.3/channel-2",
      "emulator@37.2.12/channel-0",
    ]);
    const tools = repository.packages[0]!;
    expect(tools.archives).toHaveLength(3);
    expect(tools.archives[0]).toEqual({
      url: "https://dl.google.com/android/repository/platform-tools_r37.0.1-linux.zip",
      size: 9054187,
      sha1: "477254aa5f903c15cf51001717bdf347fb6b53e0",
      hostOs: "linux",
      hostArch: null,
    });
    expect(Object.keys(images.licenses)).toEqual(["android-sdk-license", "android-sdk-arm-dbt-license"]);
  });

  it("resolves sys-img archive URLs against the sys-img directory", async () => {
    const { images } = await parsed();
    const image = images.packages.find((pkg) => pkg.path === "system-images;android-36;google_apis;x86_64")!;
    expect(image.archives[0]?.url).toBe("https://dl.google.com/android/repository/sys-img/google_apis/x86_64-36_r07.zip");
    expect(image.dependencies).toEqual([{ path: "emulator", minRevision: "35.4.9" }]);
    expect(image.typeDetails?.attrs.type).toBe("sys-img:sysImgDetailsType");
  });
});

describe("buildCatalog", () => {
  it("picks the newest stable emulator and platform-tools for Linux x64", async () => {
    const catalog = await catalogFor(LINUX);
    expect(catalog.emulator).toMatchObject({
      path: "emulator",
      revision: "37.2.12",
      licenseId: "android-sdk-license",
      archive: {
        url: "https://dl.google.com/android/repository/emulator-linux_x64-16428233.zip",
        size: 349654171,
        sha1: "cd7362ea55dfb86a418958138dc396e74165dd01",
        hostOs: "linux",
        hostArch: "x64",
      },
    });
    expect(catalog.platformTools.revision).toBe("37.0.1");
    expect(catalog.platformTools.archive.url).toMatch(/platform-tools_r37\.0\.1-linux\.zip$/);
    expect(catalog.fetchedAt).toBe("2026-10-07T00:00:00.000Z");
  });

  it("lists stable google_apis images for the host ABI, newest first", async () => {
    const catalog = await catalogFor(LINUX);
    expect(catalog.systemImages.map((image) => image.path)).toEqual([
      "system-images;android-37.0;google_apis;x86_64",
      "system-images;android-36.1;google_apis;x86_64",
      "system-images;android-36;google_apis;x86_64",
      "system-images;android-35;google_apis;x86_64",
      "system-images;android-34;google_apis;x86_64",
    ]);
    const android36 = catalog.systemImages.find((image) => image.api === 36)!;
    expect(android36).toMatchObject({
      revision: "7",
      versionName: "16",
      abi: "x86_64",
      archive: { size: 1895447397, sha1: "c6bf44bdcd885bb902b4ba752d111a073ad7a817", hostOs: null, hostArch: null },
    });
    expect(emulatorRequirement(android36)).toBe("35.4.9");
    expect(catalog.systemImages.map((image) => image.api)).toEqual([37, 36.1, 36, 35, 34]);
    expect(Object.keys(catalog.licenses)).toEqual(["android-sdk-license"]);
  });

  it("keeps the remote type-details for package.xml", async () => {
    const catalog = await catalogFor(LINUX);
    const details = (catalog.systemImages[2] as { typeDetailsXml?: string }).typeDetailsXml;
    expect(details).toContain("<api-level>36</api-level>");
    expect(details).toContain("<abi>x86_64</abi>");
  });

  it("selects the Apple silicon emulator and arm64 images with their license", async () => {
    const catalog = await catalogFor(MAC_ARM);
    expect(catalog.emulator.archive.url).toMatch(/emulator-darwin_aarch64-16428233\.zip$/);
    expect(catalog.platformTools.archive.url).toMatch(/-darwin\.zip$/);
    expect(catalog.systemImages.map((image) => image.path)).toEqual([
      "system-images;android-36;google_apis;arm64-v8a",
      "system-images;android-35;google_apis;arm64-v8a",
    ]);
    expect(Object.keys(catalog.licenses).sort()).toEqual(["android-sdk-arm-dbt-license", "android-sdk-license"]);
  });

  it("selects the Windows archives", async () => {
    const catalog = await catalogFor(WINDOWS);
    expect(catalog.emulator.archive.url).toMatch(/emulator-windows_x64-16428233\.zip$/);
    expect(catalog.platformTools.archive.url).toMatch(/-win\.zip$/);
  });

  it("fails when the host has no emulator archive", async () => {
    const { repository, images } = await parsed();
    expect(() =>
      buildCatalog(repository, images, { hostOs: "linux", hostArch: "aarch64", abi: "arm64-v8a" }, "now", (path) => `missing ${path}`),
    ).toThrow("missing emulator");
  });
});

describe("system image helpers", () => {
  it("matches only plain google_apis images", () => {
    expect(systemImageApi("system-images;android-36;google_apis;x86_64")).toEqual({ api: 36, abi: "x86_64" });
    expect(systemImageApi("system-images;android-36.1;google_apis;x86_64")).toEqual({ api: 36.1, abi: "x86_64" });
    expect(systemImageApi("system-images;android-36-ext18;google_apis;x86_64")).toBeNull();
    expect(systemImageApi("system-images;android-36;google_apis_ps16k;x86_64")).toBeNull();
    expect(systemImageApi("system-images;android-37.2-beta1;google_apis_ps16k;x86_64")).toBeNull();
  });

  it("names Android versions", () => {
    expect(versionName(32)).toBe("12L");
    expect(versionName(36)).toBe("16");
    expect(versionName(36.1)).toBe("16");
    expect(versionName(99)).toBe("API 99");
  });
});
