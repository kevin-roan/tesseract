export const usageKeys = {
  all: (sandboxId: string) => ["sandbox", sandboxId, "usage"] as const,
  report: (sandboxId: string, days: number) => ["sandbox", sandboxId, "usage", { days }] as const,
};
