export const MASTER_HOST_LABELS = {
  invalidLink: (reason: string) => `That is not a valid host shell link: ${reason}`,
  noSandbox: "Connect to a sandbox before linking its host shell",
  localSandbox: "The active sandbox runs on this computer; use This computer instead",
  unlinked: "No host shell is linked to this Tesseract yet; paste its tesseract://host link",
  remoteManaged: "This host shell runs on another machine; change it there with tesseract server",
} as const;
