import { ACCOUNT_ERRORS } from "../utils/content";

export const NETWORK_ERROR_CODE = "network_error";
export const NOT_CONFIGURED_CODE = "not_configured";
export const INVALID_RESPONSE_CODE = "invalid_response";

export class AccountApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AccountApiError";
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof AccountApiError && error.status === 401 && error.code !== "invalid_credentials";
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: ACCOUNT_ERRORS.invalidCredentials,
  email_taken: ACCOUNT_ERRORS.emailTaken,
  [NETWORK_ERROR_CODE]: ACCOUNT_ERRORS.network,
  [NOT_CONFIGURED_CODE]: ACCOUNT_ERRORS.notConfigured,
};

export function describeAccountError(error: unknown): string {
  if (error instanceof AccountApiError) {
    if (isUnauthorized(error)) return ACCOUNT_ERRORS.unauthorized;
    return MESSAGES[error.code] ?? (error.message || ACCOUNT_ERRORS.unknown);
  }
  return error instanceof Error && error.message ? error.message : ACCOUNT_ERRORS.unknown;
}
