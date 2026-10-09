export const LEGACY_LABELS = {
  copiedDir: (from: string, to: string) => `Copied ${from} to ${to} (Tesseract was called Monolith before)`,
  pinnedSdk: (root: string) => `Using the Android SDK installed before the rename at ${root}`,
  envMigrated: (file: string, backup: string) => `Renamed the old setting names in ${file}; the original is kept as ${backup}`,
  stoppingLegacy: (project: string) => `Stopping the old "${project}" sandbox (its volumes are kept)`,
  legacyDownFailed: (project: string, detail: string) => `Could not stop the old "${project}" sandbox: ${detail}`,
  movingVolume: (from: string, to: string) => `Moving volume ${from} to ${to}; this runs once and can take a while`,
  oldVolumeKept: (from: string, to: string) => `Copied ${from} to ${to} but could not remove ${from}; remove it with: docker volume rm ${from}`,
  noCopyImage: (from: string) => `Cannot copy volume ${from}: no sandbox image is on this computer to run the copy`,
  copyFailed: (from: string, to: string, detail: string) => `Copying volume ${from} to ${to} failed: ${detail}`,
} as const;
