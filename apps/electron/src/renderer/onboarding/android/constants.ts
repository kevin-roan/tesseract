import type { AccelCheck, AvdDeviceProfile, SdkCandidate } from "../../../shared/contracts/android";
import type { OnboardingUrlKey } from "../../../shared/contracts/onboarding";

export const DEFAULT_IMAGE_API = 36;
export const VISIBLE_IMAGE_LIMIT = 6;
export const SKELETON_ROWS = 3;
export const CHEVRON_OPEN_DEG = 180;

export const AVD_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
export const AVD_NAME_PREFIX = "Monolith_API_";

export const MEMORY_MB = { min: 1024, max: 8192, step: 512, small: 2048, large: 4096 } as const;
export const LARGE_HOST_BYTES = 12 * 1024 ** 3;
export const CORES = { min: 1, step: 1, preferredMin: 2, preferredMax: 4 } as const;
export const STORAGE_GB = { min: 2, max: 64, step: 1, default: 6 } as const;
export const MB_PER_GB = 1024;

export const DISK_FACTOR = 2.4;
export const FREE_SPACE_FACTOR = 3;

export interface DeviceProfile {
  id: AvdDeviceProfile;
  label: string;
}

export const DEVICE_PROFILES: readonly DeviceProfile[] = [
  { id: "pixel_5", label: "Pixel 5 · 1080 × 2340 · 440 dpi" },
  { id: "pixel_8", label: "Pixel 8 · 1080 × 2400 · 420 dpi" },
  { id: "medium_phone", label: "Medium Phone · 1080 × 2400 · 420 dpi" },
  { id: "pixel_tablet", label: "Pixel Tablet · 2560 × 1600 · 320 dpi" },
];

export const DEFAULT_DEVICE: AvdDeviceProfile = "pixel_5";

export const ACCEL_DOCS_URL: OnboardingUrlKey = "android_accel_docs";

export const ACCEL_COMMANDS: Partial<Record<NonNullable<AccelCheck["action"]>, string>> = {
  "kvm-group": "sudo usermod -aG kvm $USER",
  "enable-whpx": "dism.exe /online /enable-feature /featurename:HypervisorPlatform /all /norestart",
};

export const DOC_ACTIONS: readonly NonNullable<AccelCheck["action"]>[] = ["accel-docs", "userns-docs"];

export const QUERY_KEYS = {
  support: ["onboarding-android", "support"],
  candidates: ["onboarding-android", "candidates"],
  catalog: ["onboarding-android", "catalog"],
  avds: (sdkRoot: string) => ["onboarding-android", "avds", sdkRoot],
  accel: (sdkRoot: string | null) => ["onboarding-android", "accel", sdkRoot],
} as const;

export const LICENSE_DIALOG_WIDTH = 640;

export const PREFERRED_SDK_SOURCES: readonly SdkCandidate["source"][] = ["THEONE_ANDROID_SDK_ROOT", "monolith-default"];
