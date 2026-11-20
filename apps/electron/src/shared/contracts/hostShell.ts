import type { AndroidLinkInfo, HostAndroidStatus, HostIosStatus, IosLinkInfo } from "@tesseract/protocol";
import type { DefineContract } from "../ipc-types";
import type { HttpProxyRequest, HttpProxyResponse } from "./http";

export type HostShellStatus = "stopped" | "starting" | "running" | "stopping" | "external" | "failed";

export interface HostPairing {
  link: string;
  /** Where this computer reaches the daemon. */
  url: string;
  /** The URL in the link when it differs from `url` (the Tesseract Network name, served from loopback). */
  publicUrl?: string;
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

export const HOST_TERMINAL_KINDS = ["shell", "claude"] as const;
export type HostTerminalKind = (typeof HOST_TERMINAL_KINDS)[number];

export const HOST_TERMINAL_TARGETS = ["local", "master"] as const;
export type HostTerminalTarget = (typeof HOST_TERMINAL_TARGETS)[number];

export interface HostTerminalRequest {
  projectId: string;
  title: string;
  kind?: HostTerminalKind;
  /** `master`: in the project's folder on the active server's master host. Default: its sync-back copy on this computer. */
  host?: HostTerminalTarget;
}

/** A sandbox project's host copy in the host workspace controller (`tesseract-controller host workspace serve`). */
export interface HostWorkspaceTarget {
  projectId: string;
  apiUrl: string;
  token: string;
  name: string;
}

export const EMULATOR_STOP_SIGNALS = ["SIGTERM", "SIGKILL"] as const;
export type EmulatorStopSignal = (typeof EMULATOR_STOP_SIGNALS)[number];

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
    /** This computer's host shell, even while host work routes to the active server's master host (terminals open here). */
    localState(): HostShellState;
    localUnlock(pin: string): HostShellState;
    androidStatus(): HostAndroidStatus;
    startEmulator(avd: string): HostAndroidStatus;
    stopEmulator(signal?: EmulatorStopSignal): HostAndroidStatus;
    linkSandbox(sandboxUrl: string, token: string): AndroidLinkInfo;
    iosStatus(): HostIosStatus;
    bootSimulator(udid: string): HostIosStatus;
    shutdownSimulator(signal?: EmulatorStopSignal): HostIosStatus;
    linkIosSandbox(sandboxUrl: string, token: string): IosLinkInfo;
    openEmulatorViewer(request: EmulatorViewerRequest): void;
    openTerminal(request: HostTerminalRequest): void;
    openWorkspace(projectId: string): HostWorkspaceTarget;
    request(id: string, request: HttpProxyRequest): HttpProxyResponse;
    abort(id: string): void;
  };
  events: {
    state: HostShellState;
  };
}>;
