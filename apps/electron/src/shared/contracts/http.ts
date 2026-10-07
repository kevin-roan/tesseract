import type { DefineContract } from "../ipc-types";

export interface HttpProxyRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyBase64: string;
}

export type HttpContract = DefineContract<{
  methods: {
    request(id: string, request: HttpProxyRequest): HttpProxyResponse;
    abort(id: string): void;
  };
  events: Record<never, never>;
}>;
