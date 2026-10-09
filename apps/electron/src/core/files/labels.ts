export const FILES_LABELS = {
  checksum: "The downloaded file does not match the artifact checksum, so it was discarded.",
  http: (status: number, statusText: string) => `The sandbox answered HTTP ${status}${statusText ? ` ${statusText}` : ""}`,
  cancelled: "The download was cancelled",
  invalidUrl: "Downloads only work over http or https",
  invalidName: "The file name is missing",
  openFailed: (error: string) => `Couldn't open the file: ${error}`,
} as const;
