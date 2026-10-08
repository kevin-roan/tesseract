import { statusForErrorCode, type ErrorCode } from "@tesseract/protocol";

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status = statusForErrorCode(code)) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = status;
  }
}

export const badRequest = (message: string) => new HttpError("bad_request", message);
export const notFound = (message: string) => new HttpError("not_found", message);
export const conflict = (message: string) => new HttpError("conflict", message);
export const unavailable = (message: string) => new HttpError("unavailable", message);
export const forbidden = (message: string) => new HttpError("forbidden", message);

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
