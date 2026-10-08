import { LIMITS } from "@tesseract/protocol/constants";

export const MAX_UPLOAD_BYTES = LIMITS.maxUploadBytes;
export const MAX_ATTACHMENTS = 10;
export const MAX_NAME_LENGTH = LIMITS.maxUploadNameLength;
export const FALLBACK_MIME_TYPE = "application/octet-stream";
export const PNG_MIME_TYPE = "image/png";
export const IMAGE_MIME_PREFIX = "image/";
export const AUDIO_MIME_PREFIX = "audio/";
export const PDF_MIME_TYPE = "application/pdf";
export const READ_CHUNK_BYTES = 1024 * 1024;
export const PICK_GRANT_TTL_MS = 10 * 60 * 1000;
export const TEXT_MIME_TYPE = "text/plain";
export const FALLBACK_UPLOAD_NAME = "file";
export const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
export const BYTE_STEP = 1024;
export const WHOLE_UNIT_FROM = 100;

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "heif", "avif", "tif", "tiff", "ico"] as const;

export const MIME_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/vnd.microsoft.icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/x-wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  flac: "audio/flac",
  weba: "audio/webm",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  ts: "text/x-typescript",
  tsx: "text/x-typescript",
  json: "application/json",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  py: "text/x-python",
  sh: "application/x-sh",
  c: "text/plain",
  h: "text/plain",
  zip: "application/zip",
  gz: "application/gzip",
  tgz: "application/gzip",
  tar: "application/x-tar",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  wasm: "application/wasm",
  apk: "application/vnd.android.package-archive",
};
