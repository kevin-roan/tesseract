import type { AndroidLinkInfo, HostAndroidStatus } from "@tesseract/protocol";
import type { DefineContract } from "../ipc-types";

export type HostShellStatus = "stopped" | "starting" | "running" | "stopping" | "external" | "failed";

export interface HostPairing {
  link: string;
  url: string;
  name: string;
  pinSet: boolean;
}

export interface HostShellState {
  status: HostShellStatus;
  pairing: HostPairing | null;
  error: string | null;
  log: string[];
  autostart: boolean;
  sessionExpiresAt: number | null;
}

export interface EmulatorViewerRequest {
  serial: string;
  title: string;
}

export type HostShellContract = DefineContract<{
  methods: {
    state(): HostShellState;
    start(): HostShellState;
    stop(): HostShellState;
    refresh(): HostShellState;
    setPin(pin: string): HostShellState;
    rotateToken(): HostShellState;
    setAutostart(enabled: boolean): HostShellState;
    unlock(pin: string): HostShellState;
    lock(): HostShellState;
    androidStatus(): HostAndroidStatus;
    startEmulator(avd: string): HostAndroidStatus;
    stopEmulator(): HostAndroidStatus;
    linkSandbox(sandboxUrl: string, token: string): AndroidLinkInfo;
    openEmulatorViewer(request: EmulatorViewerRequest): void;
  };
  events: {
    state: HostShellState;
  };
}>;
