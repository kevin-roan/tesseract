import type { TailnetStatus } from "@tesseract/protocol";
import type { DefineContract } from "../ipc-types";

/** Whether the host shell and host workspace join the Tesseract Network: `auto` = when signed in and Tailscale isn't running. */
export const HOST_TAILNET_MODES = ["auto", "on", "off"] as const;
export type HostTailnetMode = (typeof HOST_TAILNET_MODES)[number];

export type HostTailnetStatus = "off" | "signed-out" | "missing" | "starting" | "running" | "needs_login" | "error";

export interface HostTailnetState {
  mode: HostTailnetMode;
  /** The mode resolved against the account and Tailscale: true when the node should run. */
  enabled: boolean;
  status: HostTailnetStatus;
  tailscaleDetected: boolean;
  /** Node name on the Tesseract Network, `<computer>-host`. */
  hostname: string | null;
  /** `http://<hostname>.<magicDnsSuffix>:7701` and `:7702` while the node runs. */
  shellUrl: string | null;
  workspaceUrl: string | null;
  node: TailnetStatus | null;
  error: string | null;
  binary: string | null;
}

export type TailnetContract = DefineContract<{
  methods: {
    state(): HostTailnetState;
    setMode(mode: HostTailnetMode): HostTailnetState;
    restart(): HostTailnetState;
  };
  events: {
    state: HostTailnetState;
  };
}>;
