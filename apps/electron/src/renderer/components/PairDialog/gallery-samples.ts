import type { HostPairingState, SandboxPairing } from "./model";

const SANDBOX_URL = "https://tesseract-sandbox.tail511d9d.ts.net";
const HOST_URL = "http://100.88.12.4:7701";

export const PAIR_SAMPLES = {
  sandbox: {
    kind: "ready",
    link: `tesseract://pair?url=${encodeURIComponent(SANDBOX_URL)}&token=fixture-token-0f3a9c27b1d84e6a9c55Yesk&name=tesseract-sandbox`,
    url: SANDBOX_URL,
    name: "tesseract-sandbox",
    online: true,
  },
  sandboxOffline: {
    kind: "ready",
    link: `tesseract://pair?url=${encodeURIComponent(SANDBOX_URL)}&token=fixture-token-0f3a9c27b1d84e6a9c55Yesk&name=tesseract-sandbox`,
    url: SANDBOX_URL,
    name: "tesseract-sandbox",
    online: false,
  },
  unconfigured: { kind: "unconfigured" },
  hostNoPin: {
    status: "running",
    error: null,
    pairing: {
      link: `tesseract://host?url=${encodeURIComponent(HOST_URL)}&token=fixture-host-token-7d21&name=workstation`,
      url: HOST_URL,
      name: "workstation",
      pinSet: false,
    },
  },
  hostStopped: { status: "stopped", error: null, pairing: null },
} as const satisfies Record<string, SandboxPairing | HostPairingState>;
