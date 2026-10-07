import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";

export const ALL = "";

export const FILE_VIEWS = ["shared", "builds"] as const;
export type FileView = (typeof FILE_VIEWS)[number];
export const DEFAULT_VIEW: FileView = "shared";

export const REFRESH_INTERVAL_MS = 30_000;
export const TAILDROP_TIMEOUT_MS = 120_000;
export const ROW_STAGGER_LIMIT = 20;
export const BAND_ICON: IconName = "project";
export const SHARED_EMPTY_ICON: IconName = "files";
export const BUILDS_EMPTY_ICON: IconName = "builds";
export const ERROR_ICON: IconName = "warning";
export const FALLBACK_FILE_NAME = "artifact";
export const OUTPUT_PLATFORM_HIDDEN = "file";

export const SOURCE_TONES: Record<"build" | "agent", Tone> = { build: "neutral", agent: "info" };

export const FILE_ICONS: Readonly<Record<string, IconName>> = {
  apk: "smartphone",
  aab: "smartphone",
  ipa: "smartphone",
  appimage: "app-window",
  exe: "app-window",
  msi: "app-window",
  dmg: "app-window",
  deb: "app-window",
  rpm: "app-window",
  zip: "file-archive",
  tar: "file-archive",
  gz: "file-archive",
  tgz: "file-archive",
  xz: "file-archive",
  "7z": "file-archive",
  pdf: "file-pdf",
  md: "file-pdf",
  txt: "file-pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  html: "file-code",
  js: "file-code",
  ts: "file-code",
  json: "file-code",
  css: "file-code",
  py: "file-code",
};

export const DEFAULT_FILE_ICON: IconName = "file";

export const SHA256_HEADER = "x-content-sha256";
