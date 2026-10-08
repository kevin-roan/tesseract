import type { AvdDeviceProfile } from "../../shared/contracts/android";

export const ANDROID_REPOSITORY_URL = "https://dl.google.com/android/repository/repository2-3.xml";
export const ANDROID_SYSIMG_URL = "https://dl.google.com/android/repository/sys-img/google_apis/sys-img2-3.xml";
export const CATALOG_URL_ENV = { repository: "TESSERACT_ANDROID_REPOSITORY_URL", systemImages: "TESSERACT_ANDROID_SYSIMG_URL" } as const;
export const CATALOG_URL_PROTOCOLS = ["http:", "https:"] as const;
export const XML_SUFFIX = ".xml";
export const DEFAULT_API_LEVEL = 36;
export const CATALOG_TIMEOUT_MS = 30_000;
export const CATALOG_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const CATALOG_CACHE_FILES = { repository: "repository2-3.xml", systemImages: "sys-img2-3.xml" } as const;
export const CATALOG_META_SUFFIX = ".meta.json";

export const STABLE_CHANNEL = "channel-0";
export const SYSTEM_IMAGE_TAG = "google_apis";
export const PACKAGE_PATHS = { emulator: "emulator", platformTools: "platform-tools" } as const;
export const SYSTEM_IMAGE_PATTERN = /^system-images;android-(\d+)(\.\d+)?;google_apis;([A-Za-z0-9_-]+)$/;
export const INSTALL_ORDER = [PACKAGE_PATHS.platformTools, PACKAGE_PATHS.emulator] as const;

export const DOWNLOAD_IDLE_TIMEOUT_MS = 30_000;
export const DOWNLOAD_RETRIES = 3;
export const DOWNLOAD_RETRY_DELAY_MS = 1_000;
export const PROGRESS_INTERVAL_MS = 200;
export const RATE_WINDOW_MS = 3_000;
export const HASH_CHUNK_BYTES = 4 * 1024 * 1024;
export const FREE_SPACE_FACTOR = 3;
export const DISK_FACTOR = 2.4;
export const GIGABYTE = 1024 ** 3;

export const SDK_TEMP_DIR = ".temp";
export const PART_SUFFIX = ".part";
export const EXTRACT_PREFIX = "x-";
export const OLD_PREFIX = "old-";
export const PACKAGE_XML = "package.xml";
export const SOURCE_PROPERTIES = "source.properties";
export const LICENSES_DIR = "licenses";

export const ZIP_MODE_SHIFT = 16;
export const MODE_TYPE_MASK = 0o170000;
export const MODE_SYMLINK = 0o120000;
export const MODE_PERMISSIONS = 0o777;

export const ACCEL_CHECK_TIMEOUT_MS = 20_000;
export const LIST_AVDS_TIMEOUT_MS = 10_000;
export const PROBE_TIMEOUT_MS = 10_000;
export const KVM_DEVICE = "/dev/kvm";
export const CPUINFO = "/proc/cpuinfo";
export const ISOLATION_PROBE = ["unshare", ["--user", "--map-root-user", "--net", "--", "ip", "link", "add", "tesseract0", "type", "dummy"]] as const;
export const WHPX_PROBE = [
  "powershell",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "(Get-CimInstance -ClassName Win32_OptionalFeature -Filter 'Name=''HypervisorPlatform''').InstallState",
  ],
] as const;
export const WHPX_ENABLED = "1";
export const HVF_PROBE = ["sysctl", ["-n", "kern.hv_support"]] as const;
export const ACCEL_HINT_CODES = {
  cpu: [3, 4, 5],
  notInstalled: [6],
  missingDevice: [8],
  disabled: [9, 10],
  permission: [11],
  ioctl: [12, 13],
} as const;

export const AVD_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
export const AVD_DIR = "avd";
export const ANDROID_USER_DIR = ".android";
export const AVD_DEFAULTS = {
  smallRamMb: 2048,
  largeRamMb: 4096,
  largeHostRamBytes: 12 * GIGABYTE,
  minRamMb: 1024,
  maxRamMb: 8192,
  ramStepMb: 512,
  minCores: 2,
  maxCores: 4,
  minStorageMb: 2 * 1024,
  maxStorageMb: 64 * 1024,
  storageMb: 6 * 1024,
  deviceProfile: "pixel_5",
} as const;

export interface DeviceProfileConfig {
  manufacturer: string;
  width: number;
  height: number;
  density: number;
}

export const DEVICE_PROFILE_CONFIG: Record<AvdDeviceProfile, DeviceProfileConfig> = {
  pixel_5: { manufacturer: "Google", width: 1080, height: 2340, density: 440 },
  pixel_8: { manufacturer: "Google", width: 1080, height: 2400, density: 420 },
  medium_phone: { manufacturer: "Generic", width: 1080, height: 2400, density: 420 },
  pixel_tablet: { manufacturer: "Google", width: 2560, height: 1600, density: 320 },
};

export const EMULATOR_PORT_RANGE = { first: 5554, last: 5682 } as const;
export const BOOT_POLL_MS = 2_000;
export const BOOT_TIMEOUT_MS = 5 * 60 * 1000;
export const EMULATOR_STOP_GRACE_MS = 20_000;
export const EMU_KILL_ARGS = ["emu", "kill"] as const;
export const TASKKILL = "taskkill";
export const ADB_TIMEOUT_MS = 5_000;
export const LOOPBACK = "127.0.0.1";
export const SCRUBBED_ENV_PREFIXES = ["TESSERACT_HOST_SHELL_"] as const;

export const ANDROID_VERSION_NAMES: Record<number, string> = {
  21: "5.0",
  22: "5.1",
  23: "6.0",
  24: "7.0",
  25: "7.1",
  26: "8.0",
  27: "8.1",
  28: "9",
  29: "10",
  30: "11",
  31: "12",
  32: "12L",
  33: "13",
  34: "14",
  35: "15",
  36: "16",
  37: "17",
};
