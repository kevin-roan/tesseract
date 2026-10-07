import type { FetchLike, HttpResponse } from "@theone/client";
import { ipc } from "../../lib/ipc";

let sequence = 0;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export const ipcFetch: FetchLike = async (url, init) => {
  const id = `req-${Date.now().toString(36)}-${(sequence += 1)}`;
  const onAbort = () => void ipc.http.abort(id);
  init.signal.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await ipc.http.request(id, { url, method: init.method, headers: init.headers, body: init.body });
    const bytes = decodeBase64(response.bodyBase64);
    const headers = new Map(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]));
    const result: HttpResponse = {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
      text: async () => new TextDecoder().decode(bytes),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    };
    return result;
  } finally {
    init.signal.removeEventListener("abort", onAbort);
  }
};
