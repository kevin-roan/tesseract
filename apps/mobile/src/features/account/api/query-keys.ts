export const accountKeys = {
  all: ["account"] as const,
  me: (accountId: string) => [...accountKeys.all, "me", accountId] as const,
  devices: (accountId: string) => [...accountKeys.all, "devices", accountId] as const,
};
