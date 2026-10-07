import type {
  AccelResult,
  AndroidHostSupport,
  AvdInfo,
  SdkCandidate,
  SdkCatalog,
  SdkPackage,
  SystemImageOption,
} from "../../../shared/contracts/android";

export const ANDROID_SCENARIOS = {
  loading: "android-loading",
  catalogError: "android-catalog-error",
  kvmDenied: "android-kvm-denied",
  licenses: "android-licenses",
  installing: "android-installing",
  failed: "android-failed",
  done: "android-done",
  doneMac: "android-done-mac",
  unsupported: "android-unsupported",
  existing: "android-existing",
} as const;

export const SDK_ROOT = "/home/dev/.local/share/theone/android-sdk";
export const STUDIO_ROOT = "/home/dev/Android/Sdk";
export const AVD_HOME = "/home/dev/.android/avd";

export const SUPPORT: Extract<AndroidHostSupport, { supported: true }> = {
  supported: true,
  hostOs: "linux",
  hostArch: "x64",
  abi: "x86_64",
  acceleration: "kvm",
  canLinkSandbox: true,
  defaultSdkRoot: SDK_ROOT,
};

export const UNSUPPORTED: Extract<AndroidHostSupport, { supported: false }> = {
  supported: false,
  reason: "Google doesn't publish the Android emulator for Linux on ARM.",
};

export const MAC_SUPPORT: AndroidHostSupport = {
  ...SUPPORT,
  canLinkSandbox: false,
  hostOs: "macosx",
  hostArch: "aarch64",
  abi: "arm64-v8a",
  acceleration: "hvf",
};

export const CANDIDATES: SdkCandidate[] = [{ path: STUDIO_ROOT, source: "studio-default", emulatorRevision: "36.1.9", systemImages: 2 }];

export const EXISTING_CANDIDATES: SdkCandidate[] = [{ path: SDK_ROOT, source: "monolith-default", emulatorRevision: "37.2.12", systemImages: 1 }];

const REPO = "https://dl.google.com/android/repository/";
const SYS_IMG = `${REPO}sys-img/google_apis/`;

const EMULATOR: SdkPackage = {
  path: "emulator",
  displayName: "Android Emulator",
  revision: "37.2.12",
  licenseId: "android-sdk-license",
  dependencies: [],
  archive: { url: `${REPO}emulator-linux_x64-16428233.zip`, size: 349_654_171, sha1: "", hostOs: "linux", hostArch: "x64" },
};

const PLATFORM_TOOLS: SdkPackage = {
  path: "platform-tools",
  displayName: "Android SDK Platform-Tools",
  revision: "37.0.1",
  licenseId: "android-sdk-license",
  dependencies: [],
  archive: { url: `${REPO}platform-tools_r37.0.1-linux.zip`, size: 9_054_187, sha1: "477254aa5f903c15cf51001717bdf347fb6b53e0", hostOs: "linux", hostArch: null },
};

const IMAGE_SPECS: readonly [api: number, version: string, revision: string, size: number, emulatorMin: string | null][] = [
  [36, "16", "7", 1_895_447_397, "36.1.0"],
  [35, "15", "9", 1_744_203_115, "35.1.0"],
  [34, "14", "14", 1_602_385_910, "33.1.0"],
  [33, "13", "17", 1_441_906_210, null],
  [32, "12L", "8", 1_310_442_002, null],
  [31, "12", "13", 1_276_118_340, null],
  [30, "11", "14", 1_098_442_660, null],
  [29, "10", "12", 1_041_007_212, null],
  [28, "9", "11", 902_118_402, null],
];

const IMAGES: SystemImageOption[] = IMAGE_SPECS.map(([api, versionName, revision, size, emulatorMin]) => ({
  path: `system-images;android-${api};google_apis;x86_64`,
  displayName: `Google APIs Intel x86_64 Atom System Image`,
  revision,
  licenseId: "android-sdk-license",
  dependencies: emulatorMin ? [{ path: "emulator", minRevision: emulatorMin }] : [],
  archive: { url: `${SYS_IMG}x86_64-${api}_r${revision.padStart(2, "0")}.zip`, size, sha1: "", hostOs: null, hostArch: null },
  api,
  versionName,
  abi: "x86_64",
}));

const SDK_LICENSE = `Terms and Conditions

This is the Android Software Development Kit License Agreement

1. Introduction

1.1 The Android Software Development Kit (referred to in the License Agreement as the "SDK" and specifically including the Android system files, packaged APIs, and Google APIs add-ons) is licensed to you subject to the terms of the License Agreement. The License Agreement forms a legally binding contract between you and Google in relation to your use of the SDK.

1.2 "Android" means the Android software stack for devices, as made available under the Android Open Source Project, which is located at the following URL: https://source.android.com/, as updated from time to time.

1.3 A "compatible implementation" means any Android device that (i) complies with the Android Compatibility Definition document, which can be found at the Android compatibility website (https://source.android.com/compatibility) and which may be updated from time to time; and (ii) successfully passes the Android Compatibility Test Suite (CTS).

1.4 "Google" means Google LLC, organized under the laws of the State of Delaware, USA, and operating under the laws of the USA with principal place of business at 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA.

2. Accepting this License Agreement

2.1 In order to use the SDK, you must first agree to the License Agreement. You may not use the SDK if you do not accept the License Agreement.`;

const PREVIEW_LICENSE = `To get started with the Android SDK Preview, you must agree to the following terms and conditions. As described below, please note that this is a preview version of the Android SDK, subject to change, that you use at your own risk. The Android SDK Preview is not a stable release, and may contain errors and defects that can result in serious damage to your computer systems, devices and data.`;

export const CATALOG: SdkCatalog = {
  fetchedAt: "2026-10-06T21:00:00.000Z",
  emulator: EMULATOR,
  platformTools: PLATFORM_TOOLS,
  systemImages: IMAGES,
  licenses: { "android-sdk-license": SDK_LICENSE, "android-sdk-preview-license": PREVIEW_LICENSE },
};

export const ACCEL_OK: AccelResult = {
  ok: true,
  emulatorCode: null,
  emulatorMessage: null,
  checks: [
    { id: "kvm", status: "ok", title: "KVM is available", detail: "/dev/kvm is readable and writable by you" },
    { id: "userns", status: "ok", title: "Network isolation works", detail: "The emulator can run in its own network namespace" },
  ],
};

export const ACCEL_DENIED: AccelResult = {
  ok: false,
  emulatorCode: 11,
  emulatorMessage: "This user doesn't have permissions to use KVM (/dev/kvm).",
  checks: [
    { id: "kvm", status: "warning", title: "You can't use /dev/kvm yet", detail: "Add yourself to the kvm group, then log out and back in.", action: "kvm-group" },
    {
      id: "userns",
      status: "warning",
      title: "Network isolation for the emulator isn't available",
      detail: "Without it the sandbox won't use the emulator.",
      action: "userns-docs",
    },
  ],
};

export const AVDS: AvdInfo[] = [{ name: "Monolith_API_36", path: `${AVD_HOME}/Monolith_API_36.avd`, target: "android-36", abi: "x86_64" }];

export const ANDROID_LOG = [
  "GET https://dl.google.com/android/repository/repository2-3.xml (cached, 304)",
  "platform-tools 37.0.1: 9.1 MB, sha1 477254aa…53e0 ok",
  "platform-tools: extracted 31 files into platform-tools/",
  "emulator 37.2.12: downloading emulator-linux_x64-16428233.zip",
];

export const SIMULATION_TICK_MS = 700;
export const SIMULATION_STEPS = 4;
