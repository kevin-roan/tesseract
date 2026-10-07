import { PREFERENCES_QUERY_KEY } from "../shared/constants";

export const CLAUDE_KEYS = {
  host: [PREFERENCES_QUERY_KEY, "claude", "host"] as const,
  auth: (baseUrl: string | null) => [PREFERENCES_QUERY_KEY, "claude", "auth", baseUrl] as const,
  accounts: (baseUrl: string | null) => [PREFERENCES_QUERY_KEY, "claude", "accounts", baseUrl] as const,
};
