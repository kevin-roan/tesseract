import type { AccountDevice } from "@tesseract/protocol";
import type { AccountState } from "../../../shared/contracts/account";
import type { HostTailnetState } from "../../../shared/contracts/tailnet";

export const ACCOUNT_SCENARIOS = {
  signedOut: "account-signed-out",
} as const;

export const FIXTURE_ACCOUNT_URL = "https://account.tesseract.example";

export const SIGNED_IN: AccountState = {
  serverUrl: FIXTURE_ACCOUNT_URL,
  account: { id: "acc_01", email: "dev@example.com", displayName: "Dev", provider: "password", createdAt: "2026-10-01T09:00:00.000Z" },
  expiresAt: "2026-12-08T09:00:00.000Z",
  persisted: true,
  error: null,
};

export const SIGNED_OUT: AccountState = { serverUrl: FIXTURE_ACCOUNT_URL, account: null, expiresAt: null, persisted: true, error: null };

export const FIXTURE_DEVICES: AccountDevice[] = [
  { id: "1", hostname: "devbox-host", dnsName: "devbox-host.tesseract.internal.", ips: ["100.64.0.1"], kind: "desktop", online: true, lastSeen: "2026-11-08T09:00:00.000Z" },
  { id: "2", hostname: "tesseract-sandbox", dnsName: "tesseract-sandbox.tesseract.internal.", ips: ["100.64.0.2"], kind: "sandbox", online: true, lastSeen: "2026-11-08T09:00:00.000Z" },
  { id: "3", hostname: "iphone", dnsName: "iphone.tesseract.internal.", ips: ["100.64.0.3"], kind: "mobile", online: false, lastSeen: "2026-11-07T18:30:00.000Z" },
];

export const TAILNET_RUNNING: HostTailnetState = {
  mode: "auto",
  enabled: true,
  status: "running",
  tailscaleDetected: false,
  hostname: "devbox-host",
  shellUrl: "http://devbox-host.tesseract.internal:7701",
  workspaceUrl: "http://devbox-host.tesseract.internal:7702",
  node: {
    state: "running",
    hostName: "devbox-host",
    dnsName: "devbox-host.tesseract.internal.",
    ips: ["100.64.0.1"],
    magicDnsSuffix: "tesseract.internal",
    loginServer: "https://net.tesseract.example",
    error: null,
    peers: [],
  },
  error: null,
  binary: "/opt/Tesseract/resources/bin/tesseract-tailnet",
};

export const TAILNET_SIGNED_OUT: HostTailnetState = {
  ...TAILNET_RUNNING,
  enabled: false,
  status: "signed-out",
  hostname: null,
  shellUrl: null,
  workspaceUrl: null,
  node: null,
};
