export const hostKeys = {
  root: ["host"] as const,
  lock: (baseUrl: string) => ["host", baseUrl, "lock"] as const,
  terminals: (baseUrl: string, session: string) => ["host", baseUrl, "terminals", session] as const,
  android: (baseUrl: string, session: string) => ["host", baseUrl, "android", session] as const,
  ios: (baseUrl: string, session: string) => ["host", baseUrl, "ios", session] as const,
  stream: (baseUrl: string, session: string) => ["host", baseUrl, "stream", session] as const,
  iosStream: (baseUrl: string, session: string) => ["host", baseUrl, "ios-stream", session] as const,
  devices: (baseUrl: string, session: string) => ["host", baseUrl, "devices", session] as const,
  workspace: (baseUrl: string, session: string) => ["host", baseUrl, "workspace", session] as const,
  workspaceProject: (workspaceId: string, projectId: string) => ["host-workspace", workspaceId, "project", projectId] as const,
  page: (baseUrl: string, session: string, id: string) => ["host", baseUrl, "page", session, id] as const,
};
