import type { DefineContract } from "../ipc-types";
import type { CheckItem } from "./common";

export type SdkHostOs = "linux" | "macosx" | "windows";
export type SdkHostArch = "x64" | "aarch64";
export type SystemImageAbi = "x86_64" | "arm64-v8a";
export type Acceleration = "kvm" | "hvf" | "whpx";

export type AndroidHostSupport =
  | { supported: true; hostOs: SdkHostOs; hostArch: SdkHostArch; abi: SystemImageAbi; acceleration: Acceleration; canLinkSandbox: boolean; defaultSdkRoot: string }
  | { supported: false; reason: string };

export interface SdkCandidate {
  path: string;
  source: "TESSERACT_ANDROID_SDK_ROOT" | "ANDROID_SDK_ROOT" | "ANDROID_HOME" | "studio-default" | "tesseract-default";
  emulatorRevision: string | null;
  systemImages: number;
}

export interface SdkArchive {
  url: string;
  size: number;
  sha1: string;
  hostOs: SdkHostOs | null;
  hostArch: SdkHostArch | null;
}

export interface SdkPackage {
  path: string;
  displayName: string;
  revision: string;
  licenseId: string | null;
  dependencies: { path: string; minRevision: string | null }[];
  archive: SdkArchive;
}

export interface SystemImageOption extends SdkPackage {
  api: number;
  versionName: string;
  abi: SystemImageAbi;
}

export interface SdkCatalog {
  fetchedAt: string;
  emulator: SdkPackage;
  platformTools: SdkPackage;
  systemImages: SystemImageOption[];
  licenses: Record<string, string>;
}

export type AvdDeviceProfile = "pixel_5" | "pixel_8" | "medium_phone" | "pixel_tablet";

export interface AvdSpec {
  name: string;
  sdkRoot: string;
  systemImage: string;
  api: number;
  abi: SystemImageAbi;
  ramMb: number;
  cores: number;
  deviceProfile: AvdDeviceProfile;
  storageMb: number;
}

export interface AvdInfo {
  name: string;
  path: string;
  target: string | null;
  abi: string | null;
}

export interface InstallPlan {
  sdkRoot: string;
  packages: string[];
  avd: AvdSpec | null;
}

export type AccelCheck = CheckItem<"kvm-group" | "enable-whpx" | "userns-docs" | "accel-docs">;

export interface AccelResult {
  ok: boolean;
  checks: AccelCheck[];
  emulatorCode: number | null;
  emulatorMessage: string | null;
}

export interface PackageProgress {
  pkg: string;
  index: number;
  count: number;
  stage: "downloading" | "verifying" | "extracting";
  received: number;
  total: number;
  bytesPerSecond: number | null;
}

export type EmulatorState =
  | { kind: "stopped" }
  | { kind: "starting"; avd: string; since: number }
  | { kind: "running"; avd: string; serial: string }
  | { kind: "stopping"; avd: string }
  | { kind: "failed"; message: string };

export type AndroidContract = DefineContract<{
  methods: {
    support(): AndroidHostSupport;
    sdkCandidates(): SdkCandidate[];
    catalog(refresh: boolean): SdkCatalog;
    acceptLicense(sdkRoot: string, licenseId: string): void;
    install(plan: InstallPlan): void;
    cancel(): void;
    accel(sdkRoot: string | null): AccelResult;
    avds(sdkRoot: string): AvdInfo[];
    createAvd(spec: AvdSpec): AvdInfo;
    deleteAvd(sdkRoot: string, name: string): void;
    emulator(): EmulatorState;
    startEmulator(sdkRoot: string, avd: string): EmulatorState;
    stopEmulator(): EmulatorState;
    log(): string[];
  };
  events: {
    progress: PackageProgress;
    emulator: EmulatorState;
    log: string;
  };
}>;
