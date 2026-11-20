export const ACCOUNT = {
  /** Account service base URL (apps/account); the Account preferences can save another one. */
  urlEnv: "TESSERACT_ACCOUNT_URL",
  sessionFile: "account-session.json",
  timeoutMs: 15_000,
  fileMode: 0o600,
} as const;

export const ACCOUNT_ERROR_CODES = {
  invalidResponse: "invalid_response",
  unreachable: "unreachable",
  unauthorized: "unauthorized",
} as const;
