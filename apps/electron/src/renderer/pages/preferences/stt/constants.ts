import { PREFERENCES_QUERY_KEY } from "../shared/constants";

export const STT_KEYS = {
  status: (baseUrl: string | null) => [PREFERENCES_QUERY_KEY, "stt", baseUrl] as const,
};
