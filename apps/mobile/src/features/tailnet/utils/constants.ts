export const TAILNET_CONFIG_KEY = "tesseract.tailnet.config";
export const TAILNET_LOOPBACK_HOST = "127.0.0.1";
export const TAILNET_READY_TIMEOUT_MS = 15_000;
export const CGNAT_FIRST_OCTET = 100;
export const CGNAT_SECOND_OCTET_MIN = 64;
export const CGNAT_SECOND_OCTET_MAX = 127;

export const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443, ws: 80, wss: 443 };
export const LOOPBACK_SCHEMES: Record<string, string> = { http: "http", https: "http", ws: "ws", wss: "ws" };
