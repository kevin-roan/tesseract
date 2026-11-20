export const HOST_TAILNET_LABELS = {
  missing: (path: string) => `tesseract-tailnet is not bundled (looked for ${path}); build it with native/tailnet/scripts/build-desktop.sh`,
  exited: (code: number | null, signal: string | null) => `tesseract-tailnet exited (${signal ?? `code ${code ?? "?"}`})`,
  keyFailed: (message: string) => `Couldn't get a device key: ${message}`,
  needsLogin: "The Tesseract Network refused this computer's key; sign in again",
} as const;
