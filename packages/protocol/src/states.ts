import {
  ERROR_CODES,
  ERROR_STATUS,
  FINAL_AGENT_RUN_STATES,
  FINAL_BUILD_STATES,
  FINAL_PROCESS_STATES,
  type ErrorCode,
} from "./constants";
import type { AgentRunState } from "./schemas/agent";
import type { ErrorBody } from "./schemas/system";
import type { BuildState } from "./schemas/builds";
import type { ProcessState } from "./schemas/processes";

const includes = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

export function isFinalProcessState(state: ProcessState): boolean {
  return includes(FINAL_PROCESS_STATES, state);
}

export function isFinalBuildState(state: BuildState): boolean {
  return includes(FINAL_BUILD_STATES, state);
}

export function isFinalAgentRunState(state: AgentRunState): boolean {
  return includes(FINAL_AGENT_RUN_STATES, state);
}

export function isErrorCode(value: string): value is ErrorCode {
  return includes(ERROR_CODES, value);
}

export function errorCodeForStatus(status: number): ErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  if (status >= 400 && status < 500) return "bad_request";
  return "internal";
}

export function statusForErrorCode(code: ErrorCode): number {
  return ERROR_STATUS[code];
}

export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}
