import type { MasterHostState } from "../../../shared/contracts/masterHost";
import type { HostPairingState, SandboxPairing } from "./model";

const SANDBOX_URL = "https://tesseract-sandbox.tail511d9d.ts.net";
const HOST_URL = "http://100.88.12.4:7701";
const MASTER_URL = "http://100.88.12.9:7701";
const MASTER_LINK = `tesseract://host?url=${encodeURIComponent(MASTER_URL)}&token=fixture-master-token-41c2&name=studio-mac`;

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
  masterUnlinked: { kind: "unlinked", sandboxUrl: SANDBOX_URL },
  masterLinked: { kind: "linked", sandboxUrl: SANDBOX_URL, host: { link: MASTER_LINK, url: MASTER_URL, name: "studio-mac", online: true } },
  masterOffline: { kind: "linked", sandboxUrl: SANDBOX_URL, host: { link: MASTER_LINK, url: MASTER_URL, name: "studio-mac", online: false } },
  masterLocal: { kind: "local" },
} as const satisfies Record<string, SandboxPairing | HostPairingState | MasterHostState>;

export const PAIR_LINK_ERROR = "That is not a tesseract://host link. Copy it from tesseract server pair.";

export const PAIR_MASTER_SAMPLES = [
  { id: "unlinked", master: PAIR_SAMPLES.masterUnlinked, linkFails: true },
  { id: "linked", master: PAIR_SAMPLES.masterLinked, linkFails: false },
  { id: "offline", master: PAIR_SAMPLES.masterOffline, linkFails: false },
] as const;
