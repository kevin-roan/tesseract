import { net } from "electron";
import { IpcError } from "../../shared/ipc-types";
import { defineService } from "./_framework/define";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const DEFAULT_TIMEOUT_MS = 600_000;
const inflight = new Map<string, AbortController>();

function headersOf(response: Response): Record<string, string> {
  const result: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export default defineService(
  "http",
  {
    request: async (_context, id, request) => {
      const url = new URL(request.url);
      if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new IpcError("forbidden", `Unsupported URL scheme ${url.protocol}`);
      const controller = new AbortController();
      inflight.set(id, controller);
      const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const response = await net.fetch(url.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: controller.signal,
          bypassCustomProtocolHandlers: true,
        });
        const body = Buffer.from(await response.arrayBuffer());
        return {
          status: response.status,
          statusText: response.statusText,
          headers: headersOf(response),
          bodyBase64: body.toString("base64"),
        };
      } catch (error) {
        if (controller.signal.aborted) throw new IpcError("cancelled", `Request to ${url.pathname} was aborted`);
        throw error;
      } finally {
        clearTimeout(timer);
        inflight.delete(id);
      }
    },
    abort: (_context, id) => {
      inflight.get(id)?.abort();
      inflight.delete(id);
    },
  },
  {
    start: () => () => {
      for (const controller of inflight.values()) controller.abort();
      inflight.clear();
    },
  },
);
