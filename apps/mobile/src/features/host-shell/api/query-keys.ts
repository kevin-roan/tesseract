export const hostKeys = {
  root: ["host"] as const,
  lock: (baseUrl: string) => ["host", baseUrl, "lock"] as const,
  terminals: (baseUrl: string, session: string) => ["host", baseUrl, "terminals", session] as const,
  android: (baseUrl: string, session: string) => ["host", baseUrl, "android", session] as const,
  page: (baseUrl: string, session: string, id: string) => ["host", baseUrl, "page", session, id] as const,
};
