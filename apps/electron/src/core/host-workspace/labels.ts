export const HOST_WORKSPACE_LABELS = {
  failed: (message: string) => `host workspace: ${message}`,
  notStarted: (url: string, log: string) => `The host workspace did not answer at ${url}; see ${log}`,
  badPairing: "The host workspace printed a pairing link without a token",
} as const;
