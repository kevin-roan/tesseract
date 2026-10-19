import type { DefineContract } from "../ipc-types";

/**
 * The host shell of the machine that runs the active sandbox (the "master" Tesseract), e.g. a Mac
 * whose sandbox this computer is connected to over the tailnet. Its `tesseract://host?…` link is
 * pasted once (from `tesseract server pair` on that machine) and remembered per sandbox API URL.
 */
export interface MasterHost {
  link: string;
  url: string;
  name: string | null;
  online: boolean;
}

export type MasterHostState =
  /** No sandbox connection is active. */
  | { kind: "none" }
  /** The active sandbox runs on this computer: "This computer" already is the master host. */
  | { kind: "local" }
  /** A remote sandbox is active, but no host link has been saved for it. */
  | { kind: "unlinked"; sandboxUrl: string }
  | { kind: "linked"; sandboxUrl: string; host: MasterHost };

export type MasterHostContract = DefineContract<{
  methods: {
    /** Reads the saved link for the active sandbox and probes `${url}/v1/health` (host-shell). */
    state(): MasterHostState;
    /** Validates a `tesseract://host?…` link and saves it for the active sandbox. */
    link(link: string): MasterHostState;
    unlink(): MasterHostState;
  };
  events: {
    state: MasterHostState;
  };
}>;
