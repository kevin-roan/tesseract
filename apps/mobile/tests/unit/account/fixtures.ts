import type { AccountDevice, AccountSession, DeviceKey, TailnetStatus } from "@tesseract/protocol";

export const sampleSession: AccountSession = {
  token: "tok_abc",
  expiresAt: "2099-01-01T00:00:00.000Z",
  account: {
    id: "acc_1",
    email: "dev@example.com",
    displayName: "Dev",
    provider: "password",
    createdAt: "2026-01-02T03:04:05.000Z",
  },
};

export const sampleDeviceKey: DeviceKey = {
  authKey: "hskey-auth-1",
  loginServer: "https://net.example.com",
  magicDnsSuffix: "tesseract.internal",
  hostname: "devs-iphone-ab12",
  tags: ["tag:tesseract-mobile"],
  expiresAt: "2099-01-01T01:00:00.000Z",
};

export const sampleDevices: AccountDevice[] = [
  {
    id: "1",
    hostname: "sandbox",
    dnsName: "sandbox.tesseract.internal.",
    ips: ["100.64.0.2"],
    kind: "sandbox",
    online: false,
    lastSeen: "2026-11-07T22:00:00.000Z",
  },
  {
    id: "2",
    hostname: "devs-iphone-ab12",
    dnsName: "devs-iphone-ab12.tesseract.internal.",
    ips: ["100.64.0.3"],
    kind: "mobile",
    online: true,
    lastSeen: null,
  },
];

export const runningStatus: TailnetStatus = {
  state: "running",
  hostName: "devs-iphone-ab12",
  dnsName: "devs-iphone-ab12.tesseract.internal.",
  ips: ["100.64.0.3", "fd7a::3"],
  magicDnsSuffix: "tesseract.internal",
  loginServer: "https://net.example.com",
  error: null,
  peers: [
    { hostName: "sandbox", dnsName: null, ips: ["100.64.0.2"], os: "linux", online: true },
    { hostName: "desk", dnsName: null, ips: ["100.64.0.4"], os: "linux", online: false },
  ],
};

export function jsonResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: async () => {
      if (body === undefined) throw new SyntaxError("no body");
      return body;
    },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as Response;
}
