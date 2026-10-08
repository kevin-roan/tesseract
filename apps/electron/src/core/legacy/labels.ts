export const LEGACY_LABELS = {
  copiedDir: (from: string, to: string) => `Copied ${from} to ${to} (Tesseract was called Monolith before)`,
  pinnedSdk: (root: string) => `Using the Android SDK installed before the rename at ${root}`,
  envMigrated: (file: string, backup: string) => `Renamed the old setting names in ${file}; the original is kept as ${backup}`,
  stoppingLegacy: (project: string) => `Stopping the old "${project}" sandbox (its volumes are kept)`,
  legacyDownFailed: (project: string, detail: string) => `Could not stop the old "${project}" sandbox: ${detail}`,
  taggedImage: (from: string, to: string) => `Tagged ${from} as ${to}`,
  copyingVolume: (from: string, to: string) => `Copying volume ${from} to ${to}; this runs once and can take a while`,
  noCopyImage: (from: string) => `Cannot copy volume ${from}: no sandbox image is on this computer to run the copy`,
  copyFailed: (from: string, to: string, detail: string) => `Copying volume ${from} to ${to} failed: ${detail}`,
} as const;
