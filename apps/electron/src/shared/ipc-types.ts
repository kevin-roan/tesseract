export type ContractMethods = Record<string, (...args: never[]) => unknown>;
export type ContractEvents = Record<string, unknown>;

export type ServiceContract = {
  methods: ContractMethods;
  events: ContractEvents;
};

export type DefineContract<T extends ServiceContract> = T;

export const IPC_ERROR_CODES = [
  "not_implemented",
  "invalid_argument",
  "not_found",
  "unavailable",
  "cancelled",
  "forbidden",
  "timeout",
  "internal",
] as const;
export type IpcErrorCode = (typeof IPC_ERROR_CODES)[number];

export interface IpcErrorPayload {
  code: IpcErrorCode;
  message: string;
  detail?: string;
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: IpcErrorPayload };

export class IpcError extends Error {
  readonly code: IpcErrorCode;
  readonly detail: string | undefined;

  constructor(code: IpcErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "IpcError";
    this.code = code;
    this.detail = detail;
  }

  toPayload(): IpcErrorPayload {
    return this.detail === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, detail: this.detail };
  }
}

export class NotImplementedError extends IpcError {
  constructor(what: string) {
    super("not_implemented", `${what} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}

export function toIpcErrorPayload(error: unknown): IpcErrorPayload {
  if (error instanceof IpcError) return error.toPayload();
  if (error instanceof Error) return { code: "internal", message: error.message };
  return { code: "internal", message: String(error) };
}

export function isIpcErrorPayload(value: unknown): value is IpcErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as IpcErrorPayload).code === "string" &&
    typeof (value as IpcErrorPayload).message === "string"
  );
}
