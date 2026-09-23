import { SECONDS } from "./env";

export interface SocketProbe {
  opened: boolean;
  protocol: string;
  first: string | Uint8Array | null;
  closeCode: number | null;
}

export function probeSocket(url: string, protocols?: string[], timeoutMs = 10 * SECONDS): Promise<SocketProbe> {
  return new Promise((resolve) => {
    const socket = new WebSocket(url, protocols);
    socket.binaryType = "arraybuffer";
    const result: SocketProbe = { opened: false, protocol: "", first: null, closeCode: null };
    const finish = () => {
      clearTimeout(timer);
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
      resolve(result);
    };
    const timer = setTimeout(finish, timeoutMs);
    socket.onopen = () => {
      result.opened = true;
      result.protocol = socket.protocol;
    };
    socket.onmessage = (message) => {
      result.first = typeof message.data === "string" ? message.data : new Uint8Array(message.data as ArrayBuffer);
      finish();
    };
    socket.onclose = (event) => {
      result.closeCode = event.code;
      finish();
    };
  });
}
